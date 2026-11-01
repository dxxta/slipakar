import ExcelJS from 'exceljs';
import type { PrismaClient } from '@prisma/client';
import type { DemoProjectUseCaseInterface } from '../../../domain/demo-project/interface.js';
import type { ResponseTypeWithoutMetadata } from '../../../lib/types.js';
import type { ProjectsRepositoryInterface } from '../../../domain/projects/interface.js';
import type { TemplatesRepositoryInterface } from '../../../domain/templates/interface.js';
import type { UploadsUseCaseInterface } from '../../../domain/uploads/interface.js';
import type { MappingUseCaseInterface } from '../../../domain/mapping/interface.js';
import type { PdfTemplatesRepositoryInterface } from '../../../domain/pdf-templates/interface.js';
import type { CampaignsRepositoryInterface } from '../../../domain/campaigns/interface.js';
import type { SmtpUseCaseInterface } from '../../../domain/smtp/interface.js';

export function buildDemoProjectUseCase({
  prisma,
  projectsRepository,
  templatesRepository,
  uploadsUseCase,
  mappingUseCase,
  pdfTemplatesRepository,
  campaignsRepository,
  smtpUseCase,
}: {
  prisma: PrismaClient;
  projectsRepository: ProjectsRepositoryInterface;
  templatesRepository: TemplatesRepositoryInterface;
  uploadsUseCase: UploadsUseCaseInterface;
  mappingUseCase: MappingUseCaseInterface;
  pdfTemplatesRepository: PdfTemplatesRepositoryInterface;
  campaignsRepository: CampaignsRepositoryInterface;
  smtpUseCase: SmtpUseCaseInterface;
}): DemoProjectUseCaseInterface {
  return {
    async seedDemoProjectUseCase({
      userId,
    }: {
      userId: string;
    }): Promise<ResponseTypeWithoutMetadata<{ projectId: string; created: boolean }>> {
      const projectName = 'Example payroll project';

      // 1. Idempotency check: see if project already exists for this user
      const existingProject = await prisma.project.findFirst({
        where: {
          name: projectName,
          ownerId: userId,
        },
      });

      if (existingProject) {
        return {
          message: 'Demo project already exists',
          data: { projectId: existingProject.id, created: false },
          success: true,
        };
      }

      // 2. Create the project
      const createdProjectRes = await projectsRepository.createProjectRepository({
        payload: { name: projectName, ownerId: userId },
        auditUserId: userId,
      });
      const projectId = createdProjectRes.data.id;

      // 3. Create email template with placeholders ({{name}}, {{period}}, {{net_pay}})
      const emailTemplateRes = await templatesRepository.createTemplateRepository({
        projectId,
        payload: {
          name: 'Payroll Notification Template',
          subject: 'Your Payslip for {{period}}',
          bodyHtml: '<p>Dear {{name}},</p><p>Your payslip for {{period}} is ready. Net pay: <strong>{{net_pay}}</strong>.</p><p>Best regards,<br>Finance Team</p>',
        },
        auditUserId: userId,
      });
      const templateId = emailTemplateRes.data.id;

      // 4. Build fictional xlsx data with 4 fictional employees on @example.com
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Employees');
      worksheet.columns = [
        { header: 'name', key: 'name' },
        { header: 'email', key: 'email' },
        { header: 'period', key: 'period' },
        { header: 'net_pay', key: 'net_pay' },
      ];
      worksheet.addRow({ name: 'Alice Smith', email: 'alice.smith@example.com', period: 'November 2026', net_pay: '$5,250.00' });
      worksheet.addRow({ name: 'Bob Jones', email: 'bob.jones@example.com', period: 'November 2026', net_pay: '$4,800.00' });
      worksheet.addRow({ name: 'Charlie Brown', email: 'charlie.brown@example.com', period: 'November 2026', net_pay: '$6,100.00' });
      worksheet.addRow({ name: 'Dana Scully', email: 'dana.scully@example.com', period: 'November 2026', net_pay: '$5,950.00' });

      const xlsxBuffer = Buffer.from(await workbook.xlsx.writeBuffer());

      // Store through normal upload/parse path via uploadsUseCase
      const uploadRes = await uploadsUseCase.createUploadsUseCase({
        projectId,
        payload: {
          buffer: xlsxBuffer,
          fileName: 'employees.xlsx',
        },
        auditUserId: userId,
      });
      const uploadId = uploadRes.data.id;

      // 5. Example PDF template
      const pdfTemplateRes = await pdfTemplatesRepository.createPdfTemplatesRepository({
        projectId,
        payload: {
          name: 'Standard Payslip PDF',
          nodeTree: {
            page: { size: 'A4', margin: 40 },
            nodes: [
              {
                id: 'header-title',
                type: 'text',
                x: 40,
                y: 40,
                width: 500,
                height: 30,
                content: 'PAYSLIP - {{period}}',
                style: {
                  fontSize: 18,
                  bold: true,
                  align: 'center',
                  color: '#111827',
                },
              },
              {
                id: 'divider-1',
                type: 'divider',
                x: 40,
                y: 80,
                width: 515,
                height: 2,
                style: {
                  color: '#E5E7EB',
                  thickness: 1,
                },
              },
              {
                id: 'employee-name',
                type: 'text',
                x: 40,
                y: 100,
                width: 300,
                height: 24,
                content: 'Employee: {{name}}',
                style: {
                  fontSize: 12,
                  bold: true,
                  align: 'left',
                  color: '#374151',
                },
              },
              {
                id: 'salary-details',
                type: 'table',
                x: 40,
                y: 140,
                width: 515,
                height: 100,
                rows: [
                  ['Description', 'Amount'],
                  ['Base Salary', '{{net_pay}}'],
                  ['Total Disbursed', '{{net_pay}}'],
                ],
                columnAligns: ['left', 'right'],
                columnWidths: [350, 165],
                headerFill: '#F3F4F6',
                zebra: true,
                boldRows: [0, 2],
                style: {
                  fontSize: 10,
                  headerBold: true,
                  borderColor: '#D1D5DB',
                },
              },
            ],
          },
        },
        auditUserId: userId,
      });

      // 6. Save mapping
      await mappingUseCase.saveMappingUseCase({
        projectId,
        auditUserId: userId,
        payload: {
          templateId,
          uploadId,
          mapping: {
            name: 'name',
            period: 'period',
            net_pay: 'net_pay',
          },
        },
      });

      // 6. SMTP connection check / placeholder
      // A draft example campaign referencing template and data (NOT sent, needs a user SMTP connection)
      // Check if user has an existing SMTP connection in this project; if not, create an example dummy SMTP connection
      let smtpId: string;
      const existingSmtp = await smtpUseCase.listSmtpUseCase({
        projectId,
        query: { page: 1, limit: 1 },
        auditUserId: userId,
      });

      if (existingSmtp.data.length > 0) {
        smtpId = existingSmtp.data[0].id;
      } else {
        const dummySmtp = await smtpUseCase.createSmtpUseCase({
          projectId,
          payload: {
            host: 'smtp.example.com',
            port: 587,
            secure: false,
            username: 'payroll@example.com',
            password: 'demo-password-123',
            fromAddress: 'payroll@example.com',
          },
          auditUserId: userId,
        });
        smtpId = dummySmtp.data.id;
      }

      // Create draft campaign
      await campaignsRepository.createCampaignsRepository({
        payload: {
          projectId,
          emailTemplateId: templateId,
          pdfTemplateId: pdfTemplateRes.data.id,
          smtpConnectionId: smtpId,
          uploadId,
          emailColumn: 'email',
          recipients: [
            { email: 'alice.smith@example.com', rowIndex: 0 },
            { email: 'bob.jones@example.com', rowIndex: 1 },
            { email: 'charlie.brown@example.com', rowIndex: 2 },
            { email: 'dana.scully@example.com', rowIndex: 3 },
          ],
        },
        auditUserId: userId,
      });

      return {
        message: 'Demo project created successfully',
        data: { projectId, created: true },
        success: true,
      };
    },
  };
}
