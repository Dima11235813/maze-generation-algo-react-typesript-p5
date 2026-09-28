import React, { useContext } from "react";
import styles from "./MazeOptionsUi.module.scss";
import { SketchPicker } from "react-color";
import CellSizeSlider from "./CellSizeSlider";
import CellWallSizeSlider from "./CellWallSizeSlider";
import { P5_MazeContext, p5_MazeContext } from "../AppContext";

export default function MazeOptionsUi() {
  return (
    <div className={styles.mazeOptionsUi}>
    </div>
  );
}
