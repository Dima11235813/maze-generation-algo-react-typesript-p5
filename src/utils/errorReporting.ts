import { ErrorReport } from "../api/models/ErrorReport"
import StackTrace, { StackFrame } from 'stacktrace-js'
import { ErrorInfo } from "react"

class ErrorReporter {
    error: Error | undefined = undefined
    errorInfo: ErrorInfo | undefined = undefined
    constructor() {

    }
    makeErrorReportCall = (errorReport: ErrorReport) => {
        fetch('/reportError', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(errorReport)
        }).then(result => {
            console.log(`Error reported with result: ${result}`)
        })

    }
    handleSuccessfulStacktrace = (stackFrames: StackFrame[]): void => {
        let strigifiedStack: string = "" // may be native stack or improve stack via stacktrace-js
        let fileNameFromStackFrame
        let lineNumberFromStackFrame
        let columnNumberFromStackFrame
        let functionNameFromStackFrame

        strigifiedStack = stackFrames.map((stackFrame: StackFrame, index: number) => {
            if (index === 0) {
                const { lineNumber, functionName, fileName, columnNumber } = stackFrame
                lineNumberFromStackFrame = lineNumber
                functionNameFromStackFrame = functionName
                fileNameFromStackFrame = fileName
                columnNumberFromStackFrame = columnNumber
            }
            return stackFrame.toString()
        }).join(" \n ")
        console.log("Stringified stack")
        console.log(strigifiedStack)

        const { message, stack } = this.error!
        console.log(JSON.stringify(stack))
        //If stacktrace-js doesn't provide a stack trace use the default one that doesn't use sourcemaps
        if (!strigifiedStack && stack) {
            strigifiedStack = stack
        }
        const url = window.location.href
        const referrer = document.referrer
        const userAgent = window.navigator.userAgent

        const browserVendor = navigator.vendor
        const os = clientInformation.platform
        const cookiesEnabled = navigator.cookieEnabled //bool
        // const memory = navigator.deviceMemory //why does ts think this doesn't exist
        const notAvail = "N/A"
        const {
            name,
            preferredName,
            isAdmin,
        } = {
            name: "Some User",
            preferredName: "Suser@gmail.com",
            isAdmin: "true"
        }
        let newErrorReport: ErrorReport = {
            stack: strigifiedStack ? strigifiedStack : "",
            componentStack: this.errorInfo && this.errorInfo.componentStack ? this.errorInfo.componentStack : notAvail,
            message,
            url,
            browserVendor: browserVendor ? browserVendor : notAvail,
            os: os ? os : notAvail,
            cookiesEnabled: cookiesEnabled !== undefined ? `${cookiesEnabled}` : notAvail,

            name: name ? name : notAvail,
            email: preferredName ? preferredName : notAvail,
            isAdmin: isAdmin ? isAdmin : notAvail,

            referrer: referrer ? referrer : notAvail,
            userAgent: userAgent ? userAgent : notAvail,

            fileName: fileNameFromStackFrame ? fileNameFromStackFrame : notAvail,
            lineNumber: lineNumberFromStackFrame ? `${lineNumberFromStackFrame}` : notAvail,
            columnNumber: columnNumberFromStackFrame ? `${columnNumberFromStackFrame}` : notAvail,
            functionName: functionNameFromStackFrame ? functionNameFromStackFrame : notAvail,

        }
        this.makeErrorReportCall(newErrorReport)
    }
    handleErrorStacktrace = (error: any) => {
        console.log(`Got error when creating stacktrace`)
        console.log(error)
    }
    reportError = (error: Error, errorInfo?: ErrorInfo): void => {
        this.error = error
        this.errorInfo = errorInfo
        this.getStackTrace(
            error,
            this.handleSuccessfulStacktrace,
            this.handleErrorStacktrace)
    }
    //This npm library offers reconciliation of stacktraces with sourcemaps if they're availableyarn 
    getStackTrace = (
        error: Error,
        callback: (value: StackFrame[]) => void,
        errCallBack: (reason: any) => void
    ) => {
        StackTrace.fromError(error).then(callback).catch(errCallBack);
    }

}

const errorReporter = new ErrorReporter()
export default errorReporter