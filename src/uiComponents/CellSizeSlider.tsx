import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
import Slider from "@material-ui/core/Slider";
import Input from "@material-ui/core/Input";
import FormatSize from "@material-ui/icons/FormatSize";

//Maze Config
import { MazeOptions } from "../mazeGenComp/mazeUtils/mazeOptions";
import { MazeOptionsSetter } from "../mazeGenComp/mazeUtils/mazeOptionsSetter";
import { Labels } from "../shared/labels";

interface CellSizeSlider {
  mazeOptionsSetter: MazeOptionsSetter;
  onSizeChange: Function;
  cellSize: number;
  windowWidth: number

}

const CellSizeSlider = (props: CellSizeSlider) => {
  const { mazeOptionsSetter, windowWidth, cellSize, onSizeChange } = props!;
  //cell width rules
  let minCellSize = 6;
  let maxCellSize = windowWidth / 20;
  let cellSizeIncrementor = 2;

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
      event.target.value === "" ? minCellSize : Number(event.target.value);
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
    if (value < minCellSize) {
      setValue(minCellSize);
      return minCellSize;
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
            value={typeof value === "number" ? value : minCellSize}
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
              min: minCellSize,
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
