import type { PdfTemplate, Prisma } from '@prisma/client';
import type { RepositoryResponse, ResponseTypeWithMetadata, ResponseTypeWithoutMetadata } from '../../lib/types.js';
import type { ListPdfTemplatesSortBy } from './dto.js';

export type PdfNodeBase = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PdfTextNode = PdfNodeBase & {
  type: 'text';
  content: string;
  style: {
    fontSize: number;
    bold: boolean;
    align: 'left' | 'center' | 'right';
    color: string;
  };
};

export type PdfImageNode = PdfNodeBase & {
  type: 'image';
  attachmentId: string;
};

export type PdfTableNode = PdfNodeBase & {
  type: 'table';
  rows: string[][];
  columnAligns?: ('left' | 'center' | 'right')[];
  columnWidths?: number[];
  headerFill?: string;
  zebra?: boolean;
  boldRows?: number[];
  style: {
    fontSize: number;
    headerBold: boolean;
    borderColor: string;
  };
};

export type PdfDividerNode = PdfNodeBase & {
  type: 'divider';
  style: {
    color: string;
    thickness: number;
  };
};

export type PdfNode = PdfTextNode | PdfImageNode | PdfTableNode | PdfDividerNode;

export type PdfNodeTree = {
  page: {
    size: 'A4';
    margin: number;
  };
  nodes: PdfNode[];
};

export type PdfTemplateView = Omit<PdfTemplate, 'nodeTree'> & {
  nodeTree: PdfNodeTree;
};

export type PdfTemplateCreateData = {
  name: string;
  nodeTree: PdfNodeTree;
};

export type PdfTemplateUpdateData = Partial<PdfTemplateCreateData>;

export type PdfTemplateFilter = {
  projectId: string;
  id?: string;
  q?: string;
};

export interface PdfTemplatesRepositoryInterface {
  createPdfTemplatesRepository(args: {
    projectId: string;
    payload: PdfTemplateCreateData;
    auditUserId: string;
    tx?: Prisma.TransactionClient;
  }): Promise<RepositoryResponse<PdfTemplateView>>;

  listPdfTemplatesRepository(args: {
    filter: PdfTemplateFilter;
    page: number;
    limit: number;
    sortBy: ListPdfTemplatesSortBy;
    sortDir: 'asc' | 'desc';
  }): Promise<RepositoryResponse<PdfTemplateView[]>>;

  getPdfTemplatesRepository(args: {
    filter: Required<Pick<PdfTemplateFilter, 'projectId' | 'id'>>;
  }): Promise<RepositoryResponse<PdfTemplateView | null>>;

  updatePdfTemplatesRepository(args: {
    filter: Required<Pick<PdfTemplateFilter, 'projectId' | 'id'>>;
    payload: PdfTemplateUpdateData;
    auditUserId: string;
    tx?: Prisma.TransactionClient;
  }): Promise<RepositoryResponse<PdfTemplateView | null>>;

  deletePdfTemplatesRepository(args: {
    filter: Required<Pick<PdfTemplateFilter, 'projectId' | 'id'>>;
    auditUserId: string;
    tx?: Prisma.TransactionClient;
  }): Promise<RepositoryResponse<boolean>>;

  countCampaignsUsingTemplateRepository(args: {
    pdfTemplateId: string;
    tx?: Prisma.TransactionClient;
  }): Promise<number>;
}

export interface PdfTemplatesUseCaseInterface {
  createPdfTemplatesUseCase(args: {
    projectId: string;
    payload: unknown;
    auditUserId: string;
  }): Promise<ResponseTypeWithoutMetadata<PdfTemplateView>>;

  listPdfTemplatesUseCase(args: {
    projectId: string;
    query?: unknown;
    auditUserId: string;
  }): Promise<ResponseTypeWithMetadata<PdfTemplateView[]>>;

  getPdfTemplatesUseCase(args: {
    projectId: string;
    id: string;
    auditUserId: string;
  }): Promise<ResponseTypeWithoutMetadata<PdfTemplateView>>;

  updatePdfTemplatesUseCase(args: {
    projectId: string;
    id: string;
    payload: unknown;
    auditUserId: string;
  }): Promise<ResponseTypeWithoutMetadata<PdfTemplateView>>;

  deletePdfTemplatesUseCase(args: {
    projectId: string;
    id: string;
    auditUserId: string;
  }): Promise<ResponseTypeWithoutMetadata<null>>;
}
