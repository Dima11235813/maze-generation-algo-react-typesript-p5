import { LOG_VERBOSE } from "../constants/loggingConstants"

export const logger = (message: string) => {
    if (LOG_VERBOSE) {
        console.log(message)
    }
}
export const loggerJson = (obj: any) => {
    if (LOG_VERBOSE) {
        console.table(obj)
    }
}

export const logRowDuringCreation = (row: number) => {
    //     logger(`
    //                 Iterating over rows
    //                 Current row ${row}
    //                 `)
}
export const logColumnDuringCreation = (column: number) => {
    //     logger(`
    //                 Iterating over columns
    //                 Current column ${column}
    //                 `)
}
export const logRowDuringDrawing = (row: number, index: number) => {
    // logger(`
    //             Iterating over rows
    //             Current row ${row}
    //             Current row index ${index}
    //             `)
}
export const logColumnDuringDrawing = (column: number, index: number) => {
    // logger(`
    //             Iterating over columns
    //             Current column ${column}
    //             Current column index ${index}
    //             `)
}

export const logVisitedCell = (col: number, row: number) =>
    console.log(`
VISITED
Column ${col}
Row ${row}
`)