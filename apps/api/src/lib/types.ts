export type PageMetadata = { page: number; limit: number; total: number };

export type RepositoryResponse<T> = { data: T; metadata?: PageMetadata };

export type ResponseTypeWithoutMetadata<T> = { message: string; data: T; success: true };

export type ResponseTypeWithMetadata<T> = ResponseTypeWithoutMetadata<T> & { metadata: PageMetadata };
