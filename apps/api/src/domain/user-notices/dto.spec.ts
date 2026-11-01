import { describe, expect, it } from 'vitest';
import { listUserNoticesQueryDto, userNoticeViewDto } from './dto.js';

describe('UserNotice DTO', () => {
  it('validates user notices list query', () => {
    const parsed = listUserNoticesQueryDto.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(20);
    expect(parsed.unreadOnly).toBe(false);
  });

  it('validates user notice view shape', () => {
    const view = userNoticeViewDto.parse({
      id: 'notice-1',
      userId: 'user-1',
      title: 'Announcement',
      message: 'System upgrade scheduled.',
      broadcastId: 'bc-1',
      readAt: null,
      createdAt: new Date().toISOString(),
    });
    expect(view.title).toBe('Announcement');
  });
});
