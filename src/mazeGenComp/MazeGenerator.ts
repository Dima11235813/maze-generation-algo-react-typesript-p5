import { CANVAS_WIDTH, CANVAS_HEIGHT } from "../constants/canvasConstants"
import { GRID_CELL_WIDTH } from "../constants/gridConstants"

import { Cell } from "./components/Cell"
import { logColumnDuringCreation, logRowDuringCreation } from "../utils/loggingUtils"
import { CurrentCell } from "./components/CurrentCell"

export class MazeGenerator {

    //nullable so that it can be dynamically generated
    columns?: number
    rows?: number

    //vars to hold current column and row during draw phase
    colIndBeingDrawn?: number
    rowIndBeingDrawn?: number

    //one dimensional array for the grid
    grid: Cell[] = []

    //hold reference to current cell in iteration
    currentCell?: CurrentCell

    constructor(p: p5) {
        p.setup = () => {
            p.createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT)

            //set up number of columns
            this.columns = p.floor(CANVAS_WIDTH / GRID_CELL_WIDTH)
            this.rows = p.floor(CANVAS_WIDTH / GRID_CELL_WIDTH)

            //set up the grid
            for (let row = 0; row < this.rows; row += 1) {
                //log set of iteration
                logRowDuringCreation(row)

                for (let column = 0; column < this.columns; column += 1) {
                    //log set of iteration
                    logColumnDuringCreation(column)

                    //make a cell
                    let cell = new Cell(column, row, p)

                    //add the cell to the grid
                    this.grid.push(cell)
                }
            }

            //set current cell as first
            this.grid[0].visited = true
        }

        p.draw = () => {
            p.background(51)
            this.grid.map(cell => cell.show())

            // new Array(this.columns).forEach((column: number, index: number, array: number[]) => {
            //     //log set of iteration
            //     logColumnDuringDrawing(column, index)

            //     new Array(this.rows).forEach((row: number, index: number, array: number[]) => {
            //         //log set of iteration
            //         logColumnDuringDrawing(row, index)

            //         //show the cell at this point
            //         this.grid[this, row].show()

            //     }, column)
            //     //pass column so that both column and row are available on inner context aka scope
            // })


        }
    }

}