export type EmbedScope = 'templates:read' | 'templates:write' | 'uploads:read' | 'uploads:write' | 'mappings:read' | 'mappings:write' | 'campaigns:read' | 'campaigns:write' | 'campaigns:send' | 'recipients:read';
export type EmbedTheme = {
  mode?: 'light' | 'dark' | 'system';
  accent?: string;
  secondary?: string;
  third?: string;
  style?: 'styled' | 'unstyled';
};
