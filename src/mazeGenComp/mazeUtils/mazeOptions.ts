import { Color } from "../../utils/colorUtils"
import { mazeDefaultOptions } from "./mazeDefaults";
import { storageUtils } from "../../utils/storageUtils";

export class MazeOptions {
    //SCENE
    backgroundColor: Color;
    //CELL COLOR
    cellColor: Color;
    cellWallColor: Color;
    //CELL SIZE
    cellSize: number;
    cellWallSize: number;
    //CELL WALL SHAPE
    cellWallStrokeCapStyle: string;
    constructor() {
        //SET UP DEFAULTS FOR MAZE if not using storage
        //SCENE
        this.backgroundColor = mazeDefaultOptions.defaultBackgroundColor
        //CELL COLOR
        this.cellColor = mazeDefaultOptions.defaultCellColor
        this.cellWallColor = mazeDefaultOptions.defaultCellWallColor
        //CELL SIZE
        this.cellSize = mazeDefaultOptions.defaultCellSize //width
        this.cellWallSize = mazeDefaultOptions.defaultCellWallSize
        //CELL WALL SHAPE
        this.cellWallStrokeCapStyle = mazeDefaultOptions.defaultStrokeCapStyle
        //Update any options that were persisted in storage
        this.updateOptionsFromStorage()
    }
    saveOptionsToStorage() {
        storageUtils.setMazeoptionsInStorage(this)
    }
    updateOptionsFromStorage() {
        storageUtils.updateMazeOptionsFromStorage(this)
    }
}