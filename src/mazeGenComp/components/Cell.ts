import { CellWallPoints } from "./CellWallPoints"
import { Point } from "./Point"
import { logger } from "../../utils/loggingUtils"
import { getPointValsAtIndex } from "../../utils/gridUtils"
import { MazeOptions } from "../mazeUtils/mazeOptions"
import { CellWallOptions } from "../../uiComponents/MazeOptionsUiExpansionPanel/CellWallStyleWrapper"
import { offsetWidthBy3dProjection, offsetHeightBy3dProjection, getProjectionFor3D } from "../mazeUtils/projectionUtils"
import { mazeOptionsUiContext } from "../../AppContext"
import { DEFAULT_Z_DISTANCE } from "../../shared/constants"

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
        this.paddingToApplyToLeft = this._padding / 2
        this.paddingToApplyToTop = this._padding / 2
        //TODO Fix this
        // logger(`Created cell at column #${column} and row #${row}`)
        //i is the column number
        //j is the row number
        this.walls = new Array(4).fill(true)
    }
    // getColorBasedOnVisited = (stackLength: number) => (1 / (this.visited + 1)) * (1 / (stackLength + 1))
    // getColorBasedOnVisited = (stackLength: number) => ((1 / this.visited * 10)) +  (1 / (stackLength * 2 + 1))
    //grid of roughly 400 cells had max of aobut 250 
    //need to calc number o cells and take 5/8s as the max number - to normalize acroos grid sizes
    //make it so that most dominant r, g, b value is oscilated by 250 based on the scope size
    getColorBasedOnVisited = () => this.visited * .242 //+ ((stackLength + 1) / 10) //+ ((stackLength + 1) / 10)
    show = (
        mazeOptions: MazeOptions,
        stackLength: number,
        inverseColorMode: boolean,
        use3d: boolean
    ) => {
        //Before executing show
        //check if anything changed about this cell

        //Don't show the cell until it's been visited
        if (this.visited === 0) {
            return
        }

        //set up point vals based on 2D or 3D projection 
        //TODO extract this logic
        let xyPoint = new Point(this.column * this._cellWidth, this.row * this._cellHeight)
        let projectedXyPoint = getProjectionFor3D(use3d, xyPoint, mazeOptions)

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
            let { r, g, b, a } = mazeOptions.cellColor
            let gValToApply = this._p.floor(g / divider)
            let bValToApply = b - this.stackSubractorFromColor
            //apply color negative if selected
            if (inverseColorMode) {
                r = 255 - r
                gValToApply = 255 - gValToApply
                bValToApply = 255 - bValToApply
            }

            logger(`
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

            // logger(`Cell Color`)
            // logger(color)
            // this._p.fill(255 / (this.getColorBasedOnVisited()),0, 0, 255)
            this._p.noStroke()
            let x_position = this.visited ? (this.row * this._cellWidth) : (this.row * this._cellWidth) / 2
            let y_position = this.visited ? (this.column * this._cellWidth) : (this.column * this._cellWidth) / 2
            let z_position = this.visited ? (this.column + this.row) * 3 : (this.column + this.row) * 3 / 2
            if (use3d) {

                this._p.push()
                this._p.translate(projectedXyPoint.x, projectedXyPoint.y, DEFAULT_Z_DISTANCE);
                this._p.box(this._cellWidth, this._cellHeight, this._cellHeight)
                this._p.pop()
            }
            // let newXyMoustPoint = new Point(this._p.mouseX, this._p.mouseY)
            // const { x, y } = getProjectionFor3D(use3d, newXyMoustPoint, mazeOptions)
            // this._p.translate(newXyMoustPoint.x , newXyMoustPoint.y)
            this._p.rect(
                projectedXyPoint.x + this.paddingToApplyToLeft,
                projectedXyPoint.y + this.paddingToApplyToTop,
                this._cellWidth,
                this._cellHeight)

        }
        //set wall options 
        //stroke
        if (mazeOptions.cellWallSize) {
            let newStrokeWeight: number = (mazeOptions.cellWallSize)
            logger(`Stroke weight is ${newStrokeWeight}`)
            this._p.strokeWeight(newStrokeWeight)
        }
        if (!use3d) {
            //stroke cap style
            if (mazeOptions.cellWallStrokeCapStyle) {
                //set stroke style
                let projectCap = this._p.PROJECT
                let squareCap = this._p.SQUARE
                let roundCap = this._p.ROUND
                logger(`Stroke weight is ${mazeOptions.cellWallStrokeCapStyle}`)
                switch (mazeOptions.cellWallStrokeCapStyle) {
                    case CellWallOptions.SQUARE:
                        this._p.strokeCap(squareCap)
                        break;
                    case CellWallOptions.PROJECT:
                        this._p.strokeCap(projectCap)
                        break;
                    case CellWallOptions.ROUND:
                        this._p.strokeCap(roundCap)
                        break;
                }
            }
        }
        //wall color
        let { r, g, b, a } = mazeOptions.cellWallColor

        //apply color negative if selected
        if (inverseColorMode) {
            r = 255 - r
            g = 255 - g
            b = 255 - b
        }
        if (a) {
            this._p.stroke(r, g, b, 255)
        } else {
            this._p.stroke(r, g, b, 255)
        }


        //Initially just draw the square - Not useful for individual cell wall drawing 
        // this._p.rect(xColPointValToDraw, yRowPointValToDraw, GRID_CELL_WIDTH, GRID_CELL_WIDTH)

        //Create 4 points - create point objects
        //point 1 @ x,y
        let point1 = new Point(projectedXyPoint.x, projectedXyPoint.y)
        //point 2 @ x + width, y
        let point2 = new Point(projectedXyPoint.x + this._cellWidth, projectedXyPoint.y)
        //point 3 @ x + width, y + width
        let point3 = new Point(projectedXyPoint.x + this._cellWidth, projectedXyPoint.y + this._cellHeight)
        //point 4 @ x, y + width
        let point4 = new Point(projectedXyPoint.x, projectedXyPoint.y + this._cellHeight)

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
    highlight = (use3d: boolean, mazeOptions: MazeOptions) => {
        var xLength = this.column * this._cellWidth
        var yLength = this.row * this._cellHeight
        let xyProjectedPoint = getProjectionFor3D(use3d, { x: xLength, y: yLength }, mazeOptions)
        // this._p.noStroke()
        this._p.fill(0, 0, 255 / this.visited + 1, 100)
        this._p.rect(xyProjectedPoint.x + this.paddingToApplyToLeft, xyProjectedPoint.y + this.paddingToApplyToTop, this._cellWidth, this._cellHeight)
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