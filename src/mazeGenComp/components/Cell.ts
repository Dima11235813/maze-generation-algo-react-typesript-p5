import { GRID_CELL_WIDTH } from "../../constants/gridConstants"
import { CellWallPoints } from "./CellWallPoints"
import { Point } from "./Point"
import { logVisitedCell, logger, loggerObj } from "../../utils/loggingUtils"
import { getPointValsAtIndex } from "../../utils/gridUtils"
import { Color } from "../../utils/colorUtils"
import { MazeOptions } from "../mazeUtils/mazeOptions"

export class Cell {
    //TOP, RIGHT, BOTTOM, LEFT
    public walls: boolean[]
    public visited = 0
    public lastVisitedState = 0
    public shouldShow = true
    public neightbors: Cell[] = []
    private stackSubractorFromColor: number = 0
    paddingToApplyToLeft: number
    paddingToApplyToTop: number
    constructor(
        public column: any,
        public row: any,
        private _p: p5,
        private _cellWidth: number,
        private _cellHeight: number,
        private _padding: number,

    ) {
        this.paddingToApplyToLeft = _padding / 2
        this.paddingToApplyToTop = _padding / 2
        //TODO Fix this
        // console.log(`Created cell at column #${column} and row #${row}`)
        //i is the column number
        //j is the row number
        this.walls = new Array(4).fill(true)
    }
    // getColorBasedOnVisited = (stackLength: number) => (1 / (this.visited + 1)) * (1 / (stackLength + 1))
    // getColorBasedOnVisited = (stackLength: number) => ((1 / this.visited * 10)) +  (1 / (stackLength * 2 + 1))
    //grid of roughly 400 cells had max of aobut 250 
    //need to calc number o cells and take 5/8s as the max number - to normalize acroos grid sizes
    //make it so that most dominant r, g, b value is oscilated by 250 based on the scope size
    getColorBasedOnVisited = () => this.visited * .42 //+ ((stackLength + 1) / 10) //+ ((stackLength + 1) / 10)
    show = (
        mazeOptions: MazeOptions,
        stackLength: number
    ) => {
        //Before executing show
        //check if anything changed about this cell

        //Don't show the cell until it's been visited
        if (this.visited === 0) {
            return
        }

        let xColPointValToDraw = this.column * this._cellWidth
        let yRowPointValToDraw = this.row * this._cellHeight


        //set fill based on if visited or not
        if (this.visited) {
            // let colorForVisited = new Color(255, 0, 255, 100)
            // const { r, g, b, a } = colorForVisited
            // this._p.fill(r, g, b, a)
            // logVisitedCell(this.column, this.row)
            //draw the rectangle
            // /https://p5js.org/reference/#/p5/fill
            const divider = this.getColorBasedOnVisited()
            if (this.stackSubractorFromColor === 0) {
                this.stackSubractorFromColor = stackLength
            }
            // else if(stackLength > this.stackSubractorFromColor){
            //     this.stackSubractorFromColor = stackLength
            // }
            logger(`Stack length ${stackLength}`)
            const { r, g, b, a } = mazeOptions.cellColor
            const gValToApply = this._p.floor(g / divider)
            const bValToApply = b - this.stackSubractorFromColor
            console.log(`
            R: ${r}
            G: ${gValToApply}
            A: ${bValToApply}
            ${a ? a : ""}
            `)
            if (a) {
                this._p.fill(
                    this._p.floor(r),
                    this._p.floor(gValToApply),
                    this._p.floor(bValToApply),
                    // a
                )
            } else {
                this._p.fill(
                    this._p.floor(r),
                    this._p.floor(gValToApply),
                    this._p.floor(bValToApply)
                )

            }

            // console.log(`Cell Color`)
            // console.log(color)
            // this._p.fill(255 / (this.getColorBasedOnVisited()),0, 0, 255)
            this._p.noStroke()
            this._p.rect(
                xColPointValToDraw + this.paddingToApplyToLeft,
                yRowPointValToDraw + this.paddingToApplyToTop,
                this._cellWidth,
                this._cellHeight)
        }
        //set wall options 
        //stroke
        if (mazeOptions.cellWallSize) {
            let newStrokeWeight: number = (mazeOptions.cellWallSize)
            console.log(`Stroke weight is ${newStrokeWeight}`)
            this._p.strokeWeight(newStrokeWeight)
        }
        //set stroke style
        let projecctCap = this._p.PROJECT
        let squareCap = this._p.SQUARE
        let roundCap = this._p.ROUND

        this._p.strokeCap(squareCap)
        //wall color
        const { r, g, b, a } = mazeOptions.cellWallColor
        if (a) {
            this._p.stroke(r, g, b, 255)
        } else {
            this._p.stroke(r, g, b, 255)
        }


        //Initially just draw the square - Not useful for individual cell wall drawing 
        // this._p.rect(xColPointValToDraw, yRowPointValToDraw, GRID_CELL_WIDTH, GRID_CELL_WIDTH)

        //Create 4 points - create point objects
        //point 1 @ x,y
        let point1 = new Point(xColPointValToDraw, yRowPointValToDraw)
        //point 2 @ x + width, y
        let point2 = new Point(xColPointValToDraw + this._cellWidth, yRowPointValToDraw)
        //point 3 @ x + width, y + width
        let point3 = new Point(xColPointValToDraw + this._cellWidth, yRowPointValToDraw + this._cellHeight)
        //point 4 @ x, y + width
        let point4 = new Point(xColPointValToDraw, yRowPointValToDraw + this._cellHeight)

        //Create bools to determine whether to draw each wall
        let drawTop = this.walls[0]
        let drawRight = this.walls[1]
        let drawBottom = this.walls[2]
        let drawLeft = this.walls[3]

        if (drawTop) {
            let pointsToDrawWallBetween = new CellWallPoints(point1, point2)
            this._drawCellWalls(pointsToDrawWallBetween)
        }
        if (drawRight) {
            let pointsToDrawWallBetween = new CellWallPoints(point2, point3)
            this._drawCellWalls(pointsToDrawWallBetween)
        }
        if (drawBottom) {
            let pointsToDrawWallBetween = new CellWallPoints(point3, point4)
            this._drawCellWalls(pointsToDrawWallBetween)
        }
        if (drawLeft) {
            let pointsToDrawWallBetween = new CellWallPoints(point4, point1)
            this._drawCellWalls(pointsToDrawWallBetween)
        }

    }
    private _drawCellWalls = (cellWallPoints: CellWallPoints) => {
        this._p.line(
            cellWallPoints.startPoint.x + this.paddingToApplyToLeft,
            cellWallPoints.startPoint.y + this.paddingToApplyToTop,
            cellWallPoints.endPoint.x + this.paddingToApplyToLeft,
            cellWallPoints.endPoint.y + this.paddingToApplyToTop
        )
    }
    highlight = () => {
        var xLength = this.column * this._cellWidth
        var yLength = this.row * this._cellHeight
        this._p.noStroke()
        this._p.fill(0, 0, 255 / this.visited + 1, 100)
        this._p.rect(xLength + this.paddingToApplyToLeft, yLength + this.paddingToApplyToTop, this._cellWidth, this._cellHeight)
    }

    getRandomNeightborToVisit = (
        numberOfColumns: number = 0,
        numberOfRows: number = 0,
        grid: Cell[]) => {

        //TODO Clean up logic in classes
        let topNeightbor = grid[getPointValsAtIndex(this.column, this.row - 1, numberOfColumns, numberOfRows)]
        let rightNeightbor = grid[getPointValsAtIndex(this.column + 1, this.row, numberOfColumns, numberOfRows)]
        let bottomNeightbor = grid[getPointValsAtIndex(this.column, this.row + 1, numberOfColumns, numberOfRows)]
        let leftNeightbor = grid[getPointValsAtIndex(this.column - 1, this.row, numberOfColumns, numberOfRows)]

        //clear out neighbors because this changes 
        this.neightbors = []

        //add any neighbors to array
        if (topNeightbor && !topNeightbor.visited) {
            this.neightbors.push(topNeightbor)
        }
        if (rightNeightbor && !rightNeightbor.visited) {
            this.neightbors.push(rightNeightbor)
        }
        if (bottomNeightbor && !bottomNeightbor.visited) {
            this.neightbors.push(bottomNeightbor)
        }
        if (leftNeightbor && !leftNeightbor.visited) {
            this.neightbors.push(leftNeightbor)
        }

        //pick random item out of array
        if (this.neightbors.length > 0) {
            let nextNeighborToVisit = this.neightbors[this._p.floor(this._p.random(0, this.neightbors.length))]
            return nextNeighborToVisit
        } else {
            return undefined
        }
    }
}