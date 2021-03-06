import { Color } from "../../utils/colorUtils"

//SET DEFAULT COLORS FOR MAZE
export const mazeDefaultOptions: MazeDefaultOptions = {
    //SCENE
    defaultBackgroundColor: new Color(113,173,245,1),
    //CELL COLOR
    defaultCellColor: new Color(65,117,5,1),
    defaultCellWallColor: new Color(255, 255, 255, 100),
    //CELL SIZE
    defaultCellSize: 40,
    defaultCellWallSize: 1,
    //CELL WALL SHAPE
    defaultStrokeCapStyle: "ROUND",
    //Rendering
    frameRate: 40,
    maxPixelDepthToRenderProjection: 100,
    //Render Type
    use3d: true,
}
export interface MazeDefaultOptions {

    defaultBackgroundColor: Color,
    //CELL COLOR
    defaultCellColor: Color,
    defaultCellWallColor: Color,
    //CELL Size
    defaultCellSize: number,
    defaultCellWallSize: number,
    //CELL WALL SHAPE
    defaultStrokeCapStyle: string,
    //Rendering
    frameRate: number,
    maxPixelDepthToRenderProjection: number,
    //Render Type
    use3d: boolean
}
