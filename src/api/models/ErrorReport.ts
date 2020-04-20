export interface ErrorReport {
    message: string,
    stack: string,
    componentStack: string,
    url: string,

    os: string,
    browserVendor: string,
    cookiesEnabled: string,

    email?: string,
    name?: string,
    isAdmin?: string,

    referrer?: string,
    userAgent?: string

    fileName: string,
    lineNumber: string,
    columnNumber: string,
    functionName: string

}