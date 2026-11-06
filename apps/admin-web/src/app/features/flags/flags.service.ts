import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { ApiClient } from '../../core/api-client';

export type FeatureFlagKey = 'scalar_docs' | 'pdf_builder' | 'self_signup';
export type FeatureFlags = Record<FeatureFlagKey, boolean>;
export type SystemConfigItem = { key: FeatureFlagKey; value: boolean };

export interface FeatureFlagMeta {
  key: FeatureFlagKey;
  label: string;
  description: string;
}

export const FEATURE_FLAG_DEFINITIONS: FeatureFlagMeta[] = [
  {
    key: 'scalar_docs',
    label: 'Scalar documentation',
    description: 'API docs page at /docs',
  },
  {
    key: 'pdf_builder',
    label: 'PDF builder',
    description: 'PDF template builder',
  },
  {
    key: 'self_signup',
    label: 'Self sign-up',
    description: 'lets new users sign up',
  },
];

function isFeatureFlagKey(key: string): key is FeatureFlagKey {
  return FEATURE_FLAG_DEFINITIONS.some((definition) => definition.key === key);
}

@Injectable({ providedIn: 'root' })
export class FlagsService {
  private readonly api = inject(ApiClient);

  getConfig(): Observable<FeatureFlags> {
    return this.api.get<SystemConfigItem[]>('/admin/config').pipe(
      map((items) => {
        const flags: FeatureFlags = { scalar_docs: false, pdf_builder: false, self_signup: false };
        for (const item of items) {
          if (isFeatureFlagKey(item.key)) flags[item.key] = item.value;
        }
        return flags;
      }),
    );
  }

  updateFlag(key: FeatureFlagKey, value: boolean): Observable<SystemConfigItem> {
    return this.api.put<SystemConfigItem, { value: boolean }>(`/admin/config/${key}`, { value });
  }
}
