import { stores } from "../../stores";
import { MazeOptions } from "../mazeUtils/mazeOptions";
import { Camera } from "p5";

export class MazeRenderer {
    mouseX: number = 0;
    mouseY: number = 0;

    dirY: number = 0;
    dirX: number = 0;

    xTranslatedCameraLocation: number = 0;
    yTranslatedCameraLocation: number = 0;
    //track rotation internally for logging
    viewRotation: number = 0
    yTranslate: number = 0;

    constructor(
        public p: p5,
        public camera: Camera,
        public mazeOptions: MazeOptions
    ) {
    }
    setCameraLocations = () => {
        const { mouseX, mouseY } = this.p

        this.dirY = (mouseX / this.p.height - 0.5) * 4;
        this.dirX = (mouseY / this.p.width - 0.5) * 4;

        const { xCameraLocation, yCameraLocation } = stores.mazeViewStore!;
        const { halfWindowHeight, halfWindowWidth } = stores.browserInfoStore

        this.xTranslatedCameraLocation = -xCameraLocation + halfWindowWidth - (this.mazeOptions.calculatedCellHeight / 4)
        this.yTranslatedCameraLocation = -yCameraLocation + halfWindowHeight - (this.mazeOptions.calculatedCellWidth / 4)
    }
    draw3dLight = () => {
        this.p.background(255);
        this.p.angleMode(this.p.RADIANS)
        const {
            runMazeMode
        } = stores.mazeViewStore!;

        if (runMazeMode) {
            this.p.pointLight(255, 255, 255, -100, -100, -100);
        } else {
            // Orange point light on the right
            this.p.pointLight(255, 255, 255, 0, 0, 600);
            this.p.pointLight(255, 255, 255, 0, 0, -600);

            // Blue directional light from the left
            this.p.directionalLight(0, 102, 255, -1, 0, 0);

            // Yellow spotlight from the front
            const { mouseX, mouseY } = this.p
            const { windowHeight } = stores.browserInfoStore
            this.p.pointLight(mouseX, mouseY, windowHeight, 255, 255, 255);
        }

    }
    applyContentManipulations = (followMouse: boolean) => {
        const { mazeView, runMazeMode, solveMazeMode } = stores.mazeViewStore!;
        const { use3dMode } = stores.uiPreferencesStore!;
        const { halfWindowWidth, halfWindowHeight } = stores.browserInfoStore
        const { PI } = this.p
        if (use3dMode) {
            if (solveMazeMode) {
                this.p.rotateX(0)
            } else if (mazeView === 0 && !runMazeMode) {
                this.p.rotateX(PI / 3)
            } else {
                // viewRotation = (PI / (((mazeView + 2 % 9) / PI)))
                this.viewRotation = this.p.sin((mazeView % 6) * 30) * PI
                this.p.rotateX(this.viewRotation);
            }
            const { mouseX, mouseY } = this.p
            const { windowHeight } = stores.browserInfoStore
            let normalizedMouseX = mouseX - halfWindowWidth
            let normalizedMouseY = mouseY - halfWindowHeight
            this.yTranslate = this.mazeOptions.view.zoomHeightDiff / windowHeight

            //Only follow mouse if maze options aren't open
            const { mazeOptionsIsOpen } = stores.uiPreferencesStore!
            // this.camera(mazeOptions.calculatedCellWidth, mazeOptions.calculatedCellHeight, 0)
            if (runMazeMode) {
                this.applyMazeRunnerRotations()
            }
            else if (followMouse && !mazeOptionsIsOpen) {
                this.p.translate(
                    normalizedMouseX,
                    (this.viewRotation > -1.8 && this.viewRotation < 1.8) ?
                        // -normalizedMouseY + (mazeOptions.windowHeight / 2 * this.yTranslate) :
                        normalizedMouseY :
                        -normalizedMouseY
                    , this.mazeOptions.view.zValue
                )
            } else {
                this.setDefaultViewTranlates()
            }
        }

    }
    setDefaultViewTranlates = () => {
        const { windowHeight } = stores.browserInfoStore
        this.p.translate(
            0,
            0 - (windowHeight / 2 * this.yTranslate),
            this.mazeOptions.view.zValue
        )
    }
    applyMazeRunnerRotations = () => {
        const { appliedRotation, peakOffset } = stores.mazeViewStore!;
        this.camera.setPosition(0, 0, 0)
        this.p.rotateY(PI / 2)
        this.p.rotateX(PI / 2)
        let quarterTurn = 2 * PI / 4
        switch (appliedRotation) {
            case 0:
                this.p.rotateZ(0)
                break;
            case 1:
                this.p.rotateZ(quarterTurn)
                break;
            case 2:
                this.p.rotateZ(quarterTurn * 2)
                break;
            case 3:
                this.p.rotateZ(quarterTurn * 3)
                break;
        }
        this.p.translate(
            this.xTranslatedCameraLocation,
            this.yTranslatedCameraLocation,
            -this.mazeOptions.cellSize / 6 - peakOffset
        )
    }
    //TODO Shader logic
    //temp
    // shader() sets the active shader with our shader
    // https://p5js.org/examples/3d-shader-using-webcam.html
    // if(this.theShader){
    //     this.p.shader(this.theShader);
    // }
    //From maze generator
    // p.preload = () => {
    //     this.theShader = p.loadShader('assets/webcam.vert', 'assets/webvam.frag')
    // }
}