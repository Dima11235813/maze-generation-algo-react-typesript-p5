
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

    //DYNAMIC SECTION
    //Window 
    windowHeight: number;
    windowWidth: number;
    calculatedCellHeight: number = 1;
    calculatedCellWidth: number = 1;
    smallerSizeOfCellHeightWidth: number = 1
    aspectRatio: number = 1;
    maxStrokeWidth: number = 1
    padding: number = 1;
    numberOfColumns: number = 10;
    numberOfRows: number = 10;
    constructor() {
        //SET UP DEFAULTS FOR MAZE if not using storage
        //SCENE
        this.backgroundColor = mazeDefaultOptions.defaultBackgroundColor
        //CELL COLOR
        this.cellColor = mazeDefaultOptions.defaultCellColor
        this.cellWallColor = mazeDefaultOptions.defaultCellWallColor
        //CELL SIZE
        this.cellSize = mazeDefaultOptions.defaultCellSize //this.windowWidth
        this.cellWallSize = mazeDefaultOptions.defaultCellWallSize
        //CELL WALL SHAPE
        this.cellWallStrokeCapStyle = mazeDefaultOptions.defaultStrokeCapStyle
        //Update any options that were persisted in storage
        this.updateOptionsFromStorage()
        this.updateDynamicValues()
        //Set UI Vars
        //TODO Move to header constants
        this.windowHeight = window.innerHeight - 90;
        this.windowWidth = window.innerWidth;

    }
    saveOptionsToStorage() {
        storageUtils.setMazeoptionsInStorage(this)
    }
    updateOptionsFromStorage() {
        storageUtils.updateMazeOptionsFromStorage(this)
    }
    updateDynamicValues() {
        //DYNAMIC OPTIONS CALC
        if(this.maxStrokeWidth > this.cellSize){
            this.maxStrokeWidth = this.cellSize
        }
        let ratioFloat = this.windowWidth / this.windowHeight
        this.aspectRatio = parseFloat(ratioFloat.toPrecision(5))
        if (this.aspectRatio > 1.0) {
            this.calculatedCellWidth = this.aspectRatio * this.cellSize
            this.calculatedCellHeight = 1 * this.cellSize
        } else {
            this.calculatedCellWidth = 1 * this.cellSize
            this.calculatedCellHeight = (1 / this.aspectRatio) * this.cellSize
        }
        //calculate stroke width base on either width or height
        this.smallerSizeOfCellHeightWidth = this.calculatedCellHeight > this.calculatedCellWidth ? this.calculatedCellWidth : this.calculatedCellHeight
        this.maxStrokeWidth = this.smallerSizeOfCellHeightWidth / 2;
        //set up number of columns and numberOfRows based on the canvas pixel size and the cell this.windowWidth constants
        this.padding = Math.floor(this.windowWidth % this.calculatedCellWidth)
        this.numberOfColumns = Math.floor(this.windowWidth / this.calculatedCellWidth)
        this.numberOfRows = Math.floor(this.windowHeight / this.calculatedCellHeight)
        console.log(`MAZE OPTIONS`)
        console.log(this)
    }
}