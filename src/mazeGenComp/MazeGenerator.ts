import { CANVAS_WIDTH, CANVAS_HEIGHT } from "../constants/canvasConstants"
import { GRID_CELL_WIDTH } from "../constants/gridConstants"

import { Cell } from "./components/Cell"
import { logColumnDuringCreation, logRowDuringCreation, logger, loggerJson } from "../utils/loggingUtils"

export class MazeGenerator {

    //nullable so that it can be dynamically generated
    numberOfColumns: number = 0
    numberOfRows: number = 0

    //vars to hold current column and row during draw phase
    colIndBeingDrawn?: number
    rowIndBeingDrawn?: number

    //one dimensional array for the grid
    grid: Cell[] = []

    //hold the path to do recursive traversal
    stack: Cell[] = []

    //hold reference to current cell in iteration
    currentCell?: Cell

    constructor(p: p5) {
        p.setup = () => {
            p.createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT)

            //set up number of columns and numberOfRows based on the canvas pixel size and the cell width constants
            this.numberOfColumns = p.floor(CANVAS_WIDTH / GRID_CELL_WIDTH)
            this.numberOfRows = p.floor(CANVAS_WIDTH / GRID_CELL_WIDTH)

            //set frame rate
            p.frameRate(20)

            //set up the grid
            for (var rowNumber = 0; rowNumber < this.numberOfRows; rowNumber += 1) {
                //log set of iteration
                logRowDuringCreation(rowNumber)

                for (var columnNumber = 0; columnNumber < this.numberOfColumns; columnNumber += 1) {
                    //log set of iteration
                    logColumnDuringCreation(columnNumber)

                    //make a cell
                    let cell = new Cell(columnNumber, rowNumber, p)

                    //add the cell to the grid
                    this.grid.push(cell)
                }
            }

            //set current cell as first
            this.currentCell = this.grid[0]
            console.log(`Grid cell ${this.grid[0]} has visited value: ${this.grid[0].visited}`)
        }

        p.draw = () => {
            //set background of canvas
            p.background(151)

            //draw each cell in the grid
            this.grid.map(cell => {
                //show the cell
                cell.show()

            })
            if (this.currentCell) {
                //set current cell as visited
                this.currentCell.visited = true

                //highlight the current cell to tell it apart from other visited ones
                this.currentCell.highlight()

                //get the random next neightbor cell from the current cell
                let nextCell
                nextCell = this.currentCell.getRandomNeightborToVisit(
                    this.numberOfColumns,
                    this.numberOfRows,
                    this.grid
                )

                if (nextCell) {
                    //set next cell to visited
                    // logger(`Setting Next Cell As Visited`)
                    nextCell.visited = true

                    //STEP 2
                    this.stack.push(this.currentCell)

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
        console.log(`Horizontal distance is ${horizontalDistance}`)
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
        console.log(`Vertical distance is ${verticalDistance}`)
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