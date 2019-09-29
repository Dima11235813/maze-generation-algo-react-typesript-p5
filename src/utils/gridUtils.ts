export const getPointValsAtIndex = (
    col: number,
    row: number,
    numColumns: number,
    numRows: number
) => {
    //Handle the (literal) edge cases
    if (
        //in case index of neighbors would be outsidd of the grid
        col < 0 ||
        row < 0 ||
        col > (numColumns - 1) ||
        row > (numRows - 1)
    ) {
        return -1
    } else {
        return col + row * numColumns
    }
}