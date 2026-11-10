import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { Avatar } from '@slipakar/ui/avatar';

describe('Avatar', () => {
  it('shows deterministic uppercase initials when no image is available', async () => {
    await TestBed.configureTestingModule({ imports: [Avatar] }).compileComponents();
    const fixture = TestBed.createComponent(Avatar);
    fixture.componentRef.setInput('name', 'Ada Lovelace');
    fixture.detectChanges();

    const avatar = fixture.nativeElement.querySelector('[data-avatar]') as HTMLElement;
    expect(avatar.textContent).toContain('AL');
    expect(avatar.getAttribute('aria-label')).toBe('Avatar for Ada Lovelace');
    expect(avatar.className).toContain('rounded-full');
    expect(avatar.style.width).toBe('28px');
    expect(avatar.style.height).toBe('28px');
    expect(avatar.style.getPropertyValue('--avatar-bg')).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('uses a fixed round 96px profile size', async () => {
    await TestBed.configureTestingModule({ imports: [Avatar] }).compileComponents();
    const fixture = TestBed.createComponent(Avatar);
    fixture.componentRef.setInput('size', 'lg');
    fixture.detectChanges();

    const avatar = fixture.nativeElement.querySelector('[data-avatar]') as HTMLElement;
    expect(avatar.style.width).toBe('96px');
    expect(avatar.style.height).toBe('96px');
    expect(avatar.className).toContain('rounded-full');
  });

  it('shows initials if the image fails to load', async () => {
    await TestBed.configureTestingModule({ imports: [Avatar] }).compileComponents();
    const fixture = TestBed.createComponent(Avatar);
    fixture.componentRef.setInput('name', 'Ada Lovelace');
    fixture.componentRef.setInput('imageUrl', '/me/avatar/user-1?v=hash');
    fixture.detectChanges();

    const image = fixture.nativeElement.querySelector('img') as HTMLImageElement;
    expect(image.getAttribute('src')).toBe('/me/avatar/user-1?v=hash');
    image.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-avatar]')?.textContent).toContain('AL');
  });
});
