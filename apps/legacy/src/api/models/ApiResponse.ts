export type ApiResponse<T> = ApiResponseSuccess<T> | ApiResponseFailed<T>;

export interface ApiResponseSuccess<T>{
    status: "success"
    message?: string;
    data: T
}
export interface ApiResponseFailed<T>{
    status: "error"|"failed"
    message?: string;
}