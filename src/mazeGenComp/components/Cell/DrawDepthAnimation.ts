import p5 from "p5";
import { ShowWallIndicator } from "./ShowWallIndicator";
import { MazeOptions } from "../../mazeUtils/mazeOptions";
import { CELL_WALL_WITH_DEPTH_Z_VALUE } from "../../../shared/constants";
import { invertColors } from "../../../utils/colorUtils";

export class DrawDepthAnimation {
    constructor(
        private _mazeOptions: MazeOptions,
        private _showWallIndicator: ShowWallIndicator,
        private _p: p5,
        private _column: number,
        private _cellWidth: number,
        private _row: number,
        private _cellHeight: number
    ) {
        if (this._showWallIndicator.drawTop) {
            this.drawWall(
                this._cellWidth,
                1 , //this._mazeOptions.cellWallSize,
                this._mazeOptions.cellSize / 2 ,// CELL_WALL_WITH_DEPTH_Z_VALUE,
                this._column * this._cellWidth + (this._cellWidth / 2),
                this._row * this._cellHeight
            )
        }
        if (this._showWallIndicator.drawRight) {
            this.drawWall(
                1 ,//this._mazeOptions.cellWallSize,
                this._cellHeight,
                this._mazeOptions.cellSize / 2 ,// CELL_WALL_WITH_DEPTH_Z_VALUE,
                (this._column + 1) * this._cellWidth,
                this._row * this._cellHeight + (this._cellHeight / 2)
            )
        }
        if (this._showWallIndicator.drawBottom) {
            this.drawWall(
                this._cellWidth,
                1, //this._mazeOptions.cellWallSize,
                this._mazeOptions.cellSize / 2 ,// CELL_WALL_WITH_DEPTH_Z_VALUE,
                this._column * this._cellWidth + (this._cellWidth / 2),
                (this._row + 1) * this._cellHeight
            )
        }
        if (this._showWallIndicator.drawLeft) {
            this.drawWall(
                1, //this._mazeOptions.cellWallSize,
                this._cellHeight,
                this._mazeOptions.cellSize / 2 ,// CELL_WALL_WITH_DEPTH_Z_VALUE,
                (this._column) * this._cellWidth,
                this._row * this._cellHeight + (this._cellHeight / 2)
            )
        }

    }
    drawWall = (
        cellWallsWithDepthX: number,
        cellWallsWithDepthY: number,
        cellWallsWithDepthZ: number,
        xTranslate: number,
        yTranslate: number
    ) => {
        this._p.push()
        //TODO Extract color inverter from cell and use here
        // let { r, g, b, a } = this._mazeOptions.cellWallColor
        // this._p.fill(r, g, b, a)
        // this._p.fill(155, 155, 155)
        let { r, g, b, a } = invertColors(this._mazeOptions.cellWallColor)
        this._p.fill(r, g, b)
        //translate to consider shape origin point have central alignment
        this._p.translate(
            xTranslate - (this._mazeOptions.windowWidth / 2) + (this._mazeOptions.padding / 2),
            yTranslate - (this._mazeOptions.windowHeight / 2) + (this._mazeOptions.padding / 2),
            0)
        // this._cellWidth > this._cellHeight ? this._cellWidth / 2 : this._cellHeight / 2);
        // this._p.texture(this._img);

        // let multiplier = Math.floor(10 * Math.abs(this._p.sin(this.depthOffset))) / 10
        this._p.box(
            cellWallsWithDepthX,
            cellWallsWithDepthY,
            cellWallsWithDepthZ
        )
        this._p.pop()
    }
}