
import { Color } from "../../utils/colorUtils"
import { mazeDefaultOptions } from "./mazeDefaults";
import { storageUtils } from "../../utils/storageUtils";
import { MazeView } from "./MazeView";
import { MIN_NUMBER_OF_CELLS_HORIZONTALLY, DEFAULT_Z_DISTANCE, ZOOM_MULTIPLIER_DEFAULT } from "../../shared/constants";

export class MazeOptions {
    view: MazeView = new MazeView();
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
    constructor(
        //SCENE
        public backgroundColor: Color = mazeDefaultOptions.defaultBackgroundColor,
        //CELL COLOR,
        public cellColor: Color = mazeDefaultOptions.defaultCellColor,
        public cellWallColor : Color= mazeDefaultOptions.defaultCellWallColor,
        //CELL SIZE,
        public cellSize : number = mazeDefaultOptions.defaultCellSize,
        public cellWallSize : number = mazeDefaultOptions.defaultCellWallSize,
        //CELL WALL SHAPE,
        public cellWallStrokeCapStyle: string = mazeDefaultOptions.defaultStrokeCapStyle,
    ) {
        //SET UP DEFAULTS FOR MAZE if not using storage
        //SCENE
        //Update any options that were persisted in storage
        this.updateOptionsFromStorage()
        this.updateDynamicValues()
        //Set UI Vars
        //TODO Move to header constants
        this.windowHeight = window.innerHeight - 90;
        this.windowWidth = window.innerWidth;
        window.addEventListener("wheel", (event: any) => {
            const minZoomSetting = 0
            let userIsZoomingIn = event.wheelDelta > 0
            if (userIsZoomingIn && this.view.zValue < minZoomSetting) {
                this.view.zValue += ZOOM_MULTIPLIER_DEFAULT
            } else {
                this.view.zValue -= ZOOM_MULTIPLIER_DEFAULT
            }
            this.view.zoomHeightDiff = this.windowHeight - this.view.zValue
        })

    }
    saveOptionsToStorage() {
        storageUtils.setMazeoptionsInStorage(this)
    }
    updateOptionsFromStorage() {
        storageUtils.updateMazeOptionsFromStorage(this)
    }
    updateDynamicValues() {
        //DYNAMIC OPTIONS CALC
        if (this.maxStrokeWidth > this.cellSize) {
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
        this.numberOfColumns = Math.floor(this.windowWidth / this.calculatedCellWidth)
        this.numberOfRows = Math.floor(this.windowHeight / this.calculatedCellHeight)
        // console.log(`MAZE OPTIONS`)
        // console.log(this)
        this.padding = .3 * this.cellSize

        //THIS Was a bad idea 
        // this.padding = Math.floor(this.windowWidth % this.calculatedCellWidth)
    }
}