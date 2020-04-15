import { ErrorReport } from "../api/models/ErrorReport"

export const reportError = (errorReport: ErrorReport) => {
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