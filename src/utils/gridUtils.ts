export const getPointValsAtIndex = (
    row: number,
    col: number,
    numColumns: number,
    numRows: number
) => {
    //Handle the (literal) edge cases
    if (
        //in case index of neighbors would be outsidd of the grid
        row < 0 ||
        col < 0 ||
        col > numColumns ||
        row > numRows
    ) {
        return -1
    } else {
        return row * col * numColumns
    }
}