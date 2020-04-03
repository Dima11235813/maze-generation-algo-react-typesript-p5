interface MazeSolverLocation {
    x: number,
    y: number,
    z: number
}

class MazeSolver {
    location: MazeSolverLocation
    constructor(

    ) {
        this.location = {

            x: 0,
            y: 0,
            z: 50,
        }

    }
}
const mazeSolver = new MazeSolver()
export default mazeSolver