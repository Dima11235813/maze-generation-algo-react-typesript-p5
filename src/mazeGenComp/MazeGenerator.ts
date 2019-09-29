import { CANVAS_WIDTH, CANVAS_HEIGHT } from "../constants/canvasConstants"
import { GRID_CELL_WIDTH } from "../constants/gridConstants"

import { Cell } from "./components/Cell"
import { logColumnDuringCreation, logRowDuringCreation, logger, loggerJson } from "../utils/loggingUtils"

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
    currentCell?: Cell

    constructor(p: p5) {
        p.setup = () => {
            p.createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT)

            //set up number of columns and rows based on the canvas pixel size and the cell width constants
            this.columns = p.floor(CANVAS_WIDTH / GRID_CELL_WIDTH)
            this.rows = p.floor(CANVAS_WIDTH / GRID_CELL_WIDTH)

            //set up the grid
            for (var rowNumber = 0; rowNumber < this.rows; rowNumber += 1) {
                //log set of iteration
                logRowDuringCreation(rowNumber)

                for (var columnNumber = 0; columnNumber < this.columns; columnNumber += 1) {
                    //log set of iteration
                    logColumnDuringCreation(columnNumber)

                    //make a cell
                    let cell = new Cell(columnNumber, rowNumber, p)

                    //add the cell to the grid
                    this.grid.push(cell)
                }
            }

            //set current cell as first
            this.grid[0].visited = true
            this.currentCell = this.grid[0]
            console.log(`Grid cell ${this.grid[0]} has visited value: ${this.grid[0].visited}`)
        }

        p.draw = () => {
            //set background of canvas
            p.background(51)

            //draw each cell in the grid
            this.grid.map(cell => {
                //show the cell
                cell.show()

                //set current cell as visited
            })
            if(this.currentCell){
                //set current cell to visited to change its color on next frame
                this.currentCell.visited = true
                
                //get the random next neightbor cell from the current cell
                let nextCell = this.currentCell.checkIfNeighborsHaveBeenVisited(
                    this.columns, 
                    this.rows,
                    this.grid
                    )

                if(nextCell){
                    //set next cell to visited
                    logger(`Setting Next Cell As Visited`)
                    nextCell.visited = true

                    logger(`Next Cell is Becoming Current Cell:`)
                    this.currentCell = nextCell
                    loggerJson(nextCell)
                }
            }



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