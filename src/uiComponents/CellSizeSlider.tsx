import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Grid from "@material-ui/core/Grid";
import Slider from "@material-ui/core/Slider";
import Input from "@material-ui/core/Input";
import FormatSize from "@material-ui/icons/FormatSize";

//Maze Config
import { MazeOptionsSetter } from "../mazeGenComp/mazeUtils/mazeOptionsSetter";
import { CELL_MIN_SIZE, MIN_NUMBER_OF_CELLS_HORIZONTALLY, CELL_SIZE_INCREMENT_INTERVAL } from "../shared/constants";

interface CellSizeSlider {
  mazeOptionsSetter: MazeOptionsSetter;
  onSizeChange: Function;
  cellSize: number;
  windowWidth: number

}

const CellSizeSlider = (props: CellSizeSlider) => {
  const { mazeOptionsSetter, windowWidth, cellSize, onSizeChange } = props!;
  //cell width rules
  let maxCellSize = windowWidth / MIN_NUMBER_OF_CELLS_HORIZONTALLY;
  let cellSizeIncrementor = CELL_SIZE_INCREMENT_INTERVAL;

  //create ui component
  const useStyles = makeStyles({
    root: {
      width: 200
    },
    input: {
      width: 42
    }
  });
  const classes = useStyles();

  //Set up state for slider
  const [value, setValue] = React.useState(cellSize);

  //Event for slider
  const handleSliderChange = (event: any, newValue: any) => {
    setStateAndPersistSelection(newValue);
  };
  //Even for input
  const handleInputChange = (event: any) => {
    let newValue =
      event.target.value === "" ? CELL_MIN_SIZE : Number(event.target.value);
    setStateAndPersistSelection(newValue);
  };
  const setStateAndPersistSelection = (newValue: number) => {
    let valueForStorage = setStateConditionally(newValue);
    updateCellSizeForMaze(valueForStorage);
  };
  const updateCellSizeForMaze = (newValue: number) => {
    mazeOptionsSetter.handleCellSizeChange(newValue);
    onSizeChange();
  };

  //state change

  const handleBlur = () => {
    setStateConditionally(value);
  };
  const setStateConditionally = (value: number): number => {
    if (value < CELL_MIN_SIZE) {
      setValue(CELL_MIN_SIZE);
      return CELL_MIN_SIZE;
    } else if (value > maxCellSize) {
      setValue(maxCellSize);
      return maxCellSize;
    } else {
      setValue(value);
      return value;
    }
  };

  return (
    <div className={classes.root}>
      <Grid container spacing={2} alignItems="center">
        <Grid item>
          <FormatSize />
        </Grid>
        <Grid item xs>
          <Slider
            value={typeof value === "number" ? value : CELL_MIN_SIZE}
            onChange={handleSliderChange}
            aria-labelledby="input-slider"
          />
        </Grid>
        <Grid item>
          <Input
            className={classes.input}
            value={value}
            margin="dense"
            onChange={handleInputChange}
            onBlur={handleBlur}
            inputProps={{
              step: cellSizeIncrementor,
              min: CELL_MIN_SIZE,
              max: maxCellSize,
              type: "number",
              "aria-labelledby": "input-slider"
            }}
          />
        </Grid>
      </Grid>
    </div>
  );
};
export default CellSizeSlider;
