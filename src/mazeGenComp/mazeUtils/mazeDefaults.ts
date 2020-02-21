import { Color } from "../../utils/colorUtils"

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
}

//SET DEFAULT COLORS FOR MAZE
export const mazeDefaultOptions: MazeDefaultOptions = {
    //SCENE
    defaultBackgroundColor: new Color(145, 101, 100, 100),
    //CELL COLOR
    defaultCellColor: new Color(9, 170, 121, 100),
    defaultCellWallColor: new Color(255, 255, 255, 100),
    //CELL SIZE
    defaultCellSize: 40,
    defaultCellWallSize: 1,
    //CELL WALL SHAPE
    defaultStrokeCapStyle: "ROUND",
}