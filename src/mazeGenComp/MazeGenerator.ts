import p5 from "p5";
import { Cell } from "./components/Cell/Cell"
import { logColumnDuringCreation, logRowDuringCreation, logger } from "../utils/loggingUtils"
import { MazeOptions } from "./mazeUtils/mazeOptions"
import { stores } from '../stores'
import { DEFAULT_Z_DISTANCE } from "../shared/constants"
import img from "../assets/exit.jpg"

export class MazeGenerator {
    //vars to hold current column and row during draw phase
    colIndBeingDrawn?: number
    rowIndBeingDrawn?: number

    //one dimensional array for the grid
    grid: Cell[] = []

    //hold the path to do recursive traversal
    stack: Cell[] = []

    //hold reference to current cell in iteration
    currentCell?: Cell
    //TODO Set up builder class for many options handling
    cam: any
    theShader: any = undefined
    zoomValue: number = DEFAULT_Z_DISTANCE
    img: any
    followMouse: boolean
    depthOscillInc = 25
    sineOffsetForDepth: any = 0.0
    sineOffsetForDepthBound: any = 68
    sineOffsetInterval: any = .4
    viewRotation: number;
    //Metrics
    currentCellNumber = 0
    numberOfCells: number = 100
    intervalForDisplayOfMetrics: number = 40
    numberOfFramesDrawn: number = 0
    logMetrics: () => void;
    mazeGenerationComplete: boolean = false
    loggedMazeGenCompleteMetrics: boolean;
    startTime: Date
    endTime: Date;
    runTime: number = 0
    constructor(
        public mazeIsActive: boolean,
        public frameRate: number,
        public p: p5,
        public mazeOptions: MazeOptions,
    ) {
        this.startTime = new Date()
        this.endTime = this.startTime
        console.log(`Maze gen constructor triggered at: ${this.startTime}`)
        //TODO set timers for temp hack until I put in better typing
        // this.img = p.loadImage("../../assets/exit.jpg");
        this.img = p.loadImage(img);
        // p.preload = () => {
        //     this.theShader = p.loadShader('assets/webcam.vert', 'assets/webvam.frag')
        // }
        p.setup = () => {
            const {use3dMode} = stores.uiPreferencesStore!;
            //TEMP
            // if (p.createCapture) {
            //     this.cam = p.createCapture(p.VIDEO);
            //     this.cam.size(710, 400);

            //     this.cam.hide();
            // }

            ///
            this.mazeOptions.updateDynamicValues()
            const { windowWidth,
                windowHeight,
                calculatedCellHeight,
                calculatedCellWidth,
                numberOfColumns,
                numberOfRows,
                padding } = mazeOptions
                //TODO Add use webQL option because defualt should be webql
                //other option is html canvas and that will have those stroke cap options
                
            // if (use3dMode) {
                p.createCanvas(windowWidth, windowHeight, p.WEBGL)
            // } else {
            //     p.createCanvas(windowWidth, windowHeight)
            // }
            //set frame rate
            // https://p5js.org/reference/#/p5/frameRate
            //https://www.geeksforgeeks.org/p5-js-framerate-function/
            this.setFrameRate()

            //set up the grid
            for (var rowNumber = 0; rowNumber < numberOfRows; rowNumber += 1) {
                //log set of iteration
                logRowDuringCreation(rowNumber)

                for (var columnNumber = 0; columnNumber < numberOfColumns; columnNumber += 1) {
                    //log set of iteration
                    logColumnDuringCreation(columnNumber)

                    //make a cell
                    this.currentCellNumber += 1
                    let cell = new Cell(
                        this.currentCellNumber,
                        columnNumber,
                        rowNumber,
                        p,
                        calculatedCellWidth,
                        calculatedCellHeight,
                        padding,
                        this.img
                    )
                    //add the cell to the grid
                    this.grid.push(cell)
                }
            }

            //set current cell as first
            this.currentCell = this.grid[0]
            //set up metrics numbers
            this.numberOfCells = this.mazeOptions.numberOfColumns * this.mazeOptions.numberOfRows
            console.log(`Number of cells ${this.numberOfCells}`)
            this.intervalForDisplayOfMetrics = 120 //Math.floor(this.numberOfCells / 20)
            console.log(`interval for display of metrics is every ${this.intervalForDisplayOfMetrics} frames`)
        }
        //https://p5js.org/reference/#/p5/mouseClicked
        //TODO Figure out how to prevent menu clicks from being registered by p5 internals
        this.followMouse = false
        p.mouseClicked = () => {
            const { mazeOptionsIsOpen } = stores.uiPreferencesStore!
            //Only toggle to follow mouse if click happens when menu is closed
            if (!mazeOptionsIsOpen) {
                this.followMouse = !this.followMouse
            }
        }
        this.logMetrics = () => {
            //keep track of how many frames were drawn
            this.setFrameRate()
            //calculate number of cells to be created
            //set up interval for logging metrics based on number of times logged for entirity of maze generation
            if (!this.mazeGenerationComplete && this.numberOfFramesDrawn % this.intervalForDisplayOfMetrics === 0) {
                let numberOfVisitsEstimate = 2.5
                let numberOfEstimatedSeconds = (this.numberOfCells * numberOfVisitsEstimate) / p.frameRate()
                let estimatedMinutes = Math.floor(numberOfEstimatedSeconds / 60)
                let estimatedSeconds = Math.floor(numberOfEstimatedSeconds * 100)
                let estimatedRunTime = `${estimatedMinutes}:${estimatedSeconds}`
                console.log(`
                FRAME RATE: ${frameRate}
                Frame rate from p.frameRate() = ${p.frameRate()} 
                Passed frame rate is ${this.frameRate}
                Extected run time is: ${estimatedRunTime} 
                View Rotation ${this.viewRotation}
                Number of visits ${this.numberOfFramesDrawn}
                Cells Created ${this.numberOfCells}
                When Maze Complete Visits to Number of Cells Ratio
                ${(this.numberOfFramesDrawn / this.numberOfCells)}
                Stack size ${this.stack.length}
                `)
            }
            if (this.mazeGenerationComplete && !this.loggedMazeGenCompleteMetrics) {
                //Convert date to unix time for milliseconds comparison
                this.runTime = Math.floor(this.endTime.getTime() / 1000 - this.startTime.getTime() / 1000)
                let minutes = this.runTime > 60 ? Math.floor(this.runTime / 60) : 0
                let seconds = this.runTime > 60 ? this.runTime % 60 : this.runTime
                let adjustedSeconds = seconds < 10 ? `0${seconds}` : seconds
                console.log(`
                Start Time  ${this.startTime}
                End Time ${this.endTime}
                Run time:  ${minutes}:${adjustedSeconds}`)
                this.loggedMazeGenCompleteMetrics = true

            }
        }
        this.loggedMazeGenCompleteMetrics = false
        this.viewRotation = 0
        p.draw = () => {
            const {use3dMode} = stores.uiPreferencesStore!;
            //Show start time of maze and store in variable for later reference
            if (this.numberOfFramesDrawn === 0) {
                this.startTime = new Date()
                console.log(`Maze generation started at: ${this.startTime}`)
            }
            this.logMetrics()
            if (use3dMode) {
                //temp
                // shader() sets the active shader with our shader
                // https://p5js.org/examples/3d-shader-using-webcam.html
                // if(this.theShader){
                //     p.shader(this.theShader);
                // }
                const mouseX = p.mouseX
                const mouseY = p.mouseY
                const dirY = (mouseX / p.height - 0.5) * 4;
                const dirX = (mouseY / p.width - 0.5) * 4;
                // p.ambientLight(255);
                // p.directionalLight(204, 204, 204, dirX, dirY, 1);
                p.background(255);

                // Orange point light on the right
                p.pointLight(255, 255, 255, 0, 0, 600);
                p.pointLight(255, 255, 255, 0, 0, -600);

                // Blue directional light from the left
                p.directionalLight(0, 102, 255, -1, 0, 0);

                // Yellow spotlight from the front
                p.pointLight(mouseX, mouseY, mazeOptions.windowHeight, 255, 255, 255);
                // p.rotateY(1.75);
                // p.rotateX(1.25);
                // p.rotateX(1.25);
                p.angleMode(p.RADIANS)
                // p.angleMode(p.DEGREES)
                const { mazeView } = stores.mazeViewStore!;
                if (mazeView === 0) {
                    p.rotateX(p.PI / 3)
                    // p.rotateX(66);
                } else {
                    // viewRotation = (p.PI / (((mazeView + 2 % 9) / p.PI)))
                    this.viewRotation = p.sin((mazeView % 6) * 30) * p.PI
                    p.rotateX(this.viewRotation);
                }
                let normalizedMouseX = mouseX - (mazeOptions.windowWidth / 2)
                let normalizedMouseY = mouseY - (mazeOptions.windowHeight / 2)
                let yTranslate = mazeOptions.view.zoomHeightDiff / mazeOptions.windowHeight

                //Only follow mouse if maze options aren't open
                const { mazeOptionsIsOpen } = stores.uiPreferencesStore!
                if (this.followMouse && !mazeOptionsIsOpen) {
                    p.translate(
                        normalizedMouseX,
                        (this.viewRotation > -1.8 && this.viewRotation < 1.8) ?
                            // -normalizedMouseY + (mazeOptions.windowHeight / 2 * yTranslate) :
                            normalizedMouseY :
                            -normalizedMouseY
                        , mazeOptions.view.zValue
                    )
                } else {
                    p.translate(
                        0,
                        0 - (mazeOptions.windowHeight / 2 * yTranslate),
                        mazeOptions.view.zValue
                    )
                }

            }

            ///
            const { numberOfColumns, numberOfRows } = mazeOptions
            // let { r, g, b, a } = mazeOptions.backgroundColor
            let { r, g, b } = mazeOptions.backgroundColor

            //set background of canvasw
            // if (a) {
            //     p.background(r, g, b, a)
            // } else {

            //Get UI Preferences
            const { inverseColorMode } = stores.uiPreferencesStore!
            //TODO Move to color util
            if (inverseColorMode) {
                r = 255 - r
                g = 255 - g
                b = 255 - b
            }
            p.background(r, g, b)

            // }
            // p.background(151)
            //draw each cell in the grid
            let increasing = true
            this.grid.map(cell => {
                //show the cell
                cell.show(mazeOptions, this.stack.length)
                if (increasing) {
                    this.sineOffsetForDepth += this.sineOffsetInterval
                    if (this.sineOffsetForDepth >= this.sineOffsetForDepthBound) {
                        increasing = false
                    }
                    // } else if (this.sineOffsetForDepth >= -p.TWO_PI) {
                } if (!increasing) {
                    this.sineOffsetForDepth -= this.sineOffsetInterval
                    if (this.sineOffsetForDepth <= -this.sineOffsetForDepthBound) {
                        increasing = true
                    }
                }
            })
            if (this.currentCell) {
                //set current cell as visited
                this.currentCell.visited += 1

                //highlight the current cell to tell it apart from other visited ones
                this.currentCell.highlight(use3dMode, mazeOptions)
                //STEP 1
                //get the random next neightbor cell from the current cell
                let nextCell
                nextCell = this.currentCell.getRandomNeightborToVisit(
                    numberOfColumns,
                    numberOfRows,
                    this.grid
                )

                if (nextCell) {
                    //STEP 2
                    this.stack.push(this.currentCell)
                    logger(`Stack length ${this.stack.length}`)

                    //STEP 3
                    this.removeWalls(this.currentCell, nextCell)
                } else {
                    //if no visitable neighbors exist then pop a cell from the stack and check its neighbors in the next iteration
                    nextCell = this.stack.pop()
                }
                if (mazeIsActive) {
                    this.currentCell = nextCell
                }
            }
            //If stack is empty that means we're back to origin and maze gen is complete
            if (!this.mazeGenerationComplete && this.stack.length === 0) {
                //log metrics one last time 
                this.logMetrics()
                //show time based metrics
                this.endTime = new Date()
                console.log(`Maze gen ended at ${this.endTime}`)
                this.mazeGenerationComplete = true
            }
            this.numberOfFramesDrawn += 1
        }
    }
    setFrameRate = () => this.p.frameRate(this.frameRate)
    removeWalls = (currentCell: Cell, nextCell: Cell) => {
        //if the current cell and the next cell share the same index column
        //it means they're above current is above next or visa versa
        //get horizontal distance value to set left or right wall on each cell
        let horizontalDistance = currentCell.column - nextCell.column
        // console.log(`Horizontal distance is ${horizontalDistance}`)
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
        // console.log(`Vertical distance is ${verticalDistance}`)
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
