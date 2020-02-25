import { Cell } from "./components/Cell"
import { logColumnDuringCreation, logRowDuringCreation, logger } from "../utils/loggingUtils"
import { MazeOptions } from "./mazeUtils/mazeOptions"
import { stores } from '../stores'

export class MazeGenerator {

    //vars to hold current column and row during draw phase
    colIndBeingDrawn?: number
    rowIndBeingDrawn?: number

    //one dimensional array for the grid
    grid: Cell[] = []

    //hold the path to do recursive traversal
    stack: Cell[] = []

    //hold reference to current cell in iteration
    currentCell?: Cell
    //TODO Set up builder class for many options handling
    constructor(p: p5, mazeOptions: MazeOptions) {
        p.setup = () => {
            mazeOptions.updateDynamicValues()
            const { windowWidth,
                windowHeight,
                calculatedCellHeight,
                calculatedCellWidth,
                numberOfColumns,
                numberOfRows,
                padding } = mazeOptions
            p.createCanvas(windowWidth, windowHeight)
            //set frame rate
            // https://p5js.org/reference/#/p5/frameRate
            p.frameRate(22)

            //set up the grid
            for (var rowNumber = 0; rowNumber < numberOfRows; rowNumber += 1) {
                //log set of iteration
                logRowDuringCreation(rowNumber)

                for (var columnNumber = 0; columnNumber < numberOfColumns; columnNumber += 1) {
                    //log set of iteration
                    logColumnDuringCreation(columnNumber)

                    //make a cell
                    let cell = new Cell(
                        columnNumber,
                        rowNumber,
                        p,
                        calculatedCellWidth,
                        calculatedCellHeight,
                        padding
                    )
                    //add the cell to the grid
                    this.grid.push(cell)
                }
            }

            //set current cell as first
            this.currentCell = this.grid[0]
        }

        p.draw = () => {
            const { numberOfColumns, numberOfRows } = mazeOptions
            // let { r, g, b, a } = mazeOptions.backgroundColor
            let { r, g, b } = mazeOptions.backgroundColor

            //set background of canvasw
            // if (a) {
            //     p.background(r, g, b, a)
            // } else {
            const { inverseColorMode } = stores.uiPreferencesStore!
            //TODO Move to color util
            if (inverseColorMode) {
                r = 255 - r
                g = 255 - g
                b = 255 - b
            }
            p.background(r, g, b)

            // }
            // p.background(151)
            //draw each cell in the grid
            this.grid.map(cell => {
                //show the cell
                cell.show(mazeOptions, this.stack.length, inverseColorMode)

            })
            if (this.currentCell) {
                //set current cell as visited
                this.currentCell.visited += 1

                //highlight the current cell to tell it apart from other visited ones
                this.currentCell.highlight()
                //STEP 1
                //get the random next neightbor cell from the current cell
                let nextCell
                nextCell = this.currentCell.getRandomNeightborToVisit(
                    numberOfColumns,
                    numberOfRows,
                    this.grid
                )

                if (nextCell) {
                    //STEP 2
                    this.stack.push(this.currentCell)
                    logger(`Stack length ${this.stack.length}`)

                    //STEP 3
                    this.removeWalls(this.currentCell, nextCell)
                } else {
                    //if no visitable neighbors exist then pop a cell from the stack and check its neighbors in the next iteration
                    nextCell = this.stack.pop()
                }
                this.currentCell = nextCell
            }
        }
    }
    removeWalls = (currentCell: Cell, nextCell: Cell) => {
        //if the current cell and the next cell share the same index column
        //it means they're above current is above next or visa versa
        //get horizontal distance value to set left or right wall on each cell
        let horizontalDistance = currentCell.column - nextCell.column
        // console.log(`Horizontal distance is ${horizontalDistance}`)
        if (horizontalDistance === 1) {
            //current cell is after the next cell 
            //so set the current cell left wall to false to remove it
            currentCell.walls[3] = false
            //so set the next cell right wall to false to remove it
            nextCell.walls[1] = false
        } else if (horizontalDistance === -1) {
            //current cell is before the next cell
            //so set the current cell right wall to true to remove it
            currentCell.walls[1] = false
            //so set the next cell left wall to false to remove it
            nextCell.walls[3] = false
        }
        //get vertical distance value to set left or right wall on each cell
        let verticalDistance = currentCell.row - nextCell.row
        // console.log(`Vertical distance is ${verticalDistance}`)
        if (verticalDistance === 1) {
            //current cell is above the next cell 
            //so set the current cell bottom wall to false to remove it
            currentCell.walls[0] = false
            //so set the next cell top wall to false to remove it
            nextCell.walls[2] = false
        } else if (verticalDistance === -1) {
            //current cell is below the next cell
            //so set the current cell top wall to false to remove it
            currentCell.walls[2] = false
            //so set the next cell bottom wall to false to remove it
            nextCell.walls[0] = false
        }
    }

}
