import { DEFAULT_Z_DISTANCE } from "../../shared/constants";

export class MazeView {
    constructor(
        public is3d: boolean = true,
        public zValue: number =  0,
        public zoomHeightDiff = DEFAULT_Z_DISTANCE

    ){

    }
}