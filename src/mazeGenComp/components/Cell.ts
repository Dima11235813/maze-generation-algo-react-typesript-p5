import { GRID_CELL_WIDTH } from "../../constants/gridConstants"

export class Cell {
    public walls: boolean[]
    constructor(public column: any, public row: any, private _p : p5) {
        //TODO Fix this

        //i is the column number
        //j is the row number
        this.walls = new Array(4).fill(true)

    }
    show = () => {
        let curColToDraw = this.column * GRID_CELL_WIDTH
        let curRowToDraw = this.row * GRID_CELL_WIDTH
        this._p.stroke(255)
        this._p.noFill()
        this._p.rect(curColToDraw, curRowToDraw, GRID_CELL_WIDTH, GRID_CELL_WIDTH)

    }
}