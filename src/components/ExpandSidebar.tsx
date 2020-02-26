import React, { useEffect } from "react";

import { makeStyles, createStyles, Theme } from "@material-ui/core/styles";
import SwipeableDrawer from "@material-ui/core/SwipeableDrawer";
import Button from "@material-ui/core/Button";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ListItemText from "@material-ui/core/ListItemText";
import Divider from "@material-ui/core/Divider";

//Matrial icons
import MailIcon from "@material-ui/icons/Mail";
import InboxIcon from "@material-ui/icons/MoveToInbox";
import AppIcon from "@material-ui/icons/Apps";

import styles from "./ExpandSidebar.module.scss";
import MazeOptionsUiExpansionPanel from "../uiComponents/MazeOptionsUiExpansionPanel";
import IconButton from "@material-ui/core/IconButton";
import Typography from "@material-ui/core/Typography";


const useMenuStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      flexGrow: 1
    },
    menuButton: {
      marginRight: theme.spacing(2)
    },
    title: {
      flexGrow: 1
    }
  })
);

const useStyles = makeStyles({
  list: {
    width: Math.floor(window.innerWidth / 5)
  },
  fullList: {
    width: "auto"
  }
});

export default function SwipeableTemporaryDrawer() {
  const menuClassStyles = useMenuStyles();
  const classes = useStyles();
  const [state, setState] = React.useState({
    top: false,
    left: false,
    bottom: false,
    right: false
  });

  type DrawerSide = "top" | "left" | "bottom" | "right";
  const toggleDrawer = (side: DrawerSide, open: boolean) => (
    event: React.KeyboardEvent | React.MouseEvent
  ) => {
    if (
      event &&
      event.type === "keydown" &&
      ((event as React.KeyboardEvent).key === "Tab" ||
        (event as React.KeyboardEvent).key === "Shift")
    ) {
      return;
    }

    setState({ ...state, [side]: open });
  };

  const sideList = (side: DrawerSide) => (
    <div className={classes.list} role="presentation">
      <MazeOptionsUiExpansionPanel />
    </div>
  );

  const fullList = (side: DrawerSide) => (
    <div
      className={classes.fullList}
      role="presentation"
      onClick={toggleDrawer(side, false)}
      onKeyDown={toggleDrawer(side, false)}
    >
      <List>
        {["Inbox", "Starred", "Send email", "Drafts"].map((text, index) => (
          <ListItem button key={text}>
            <ListItemIcon>
              {index % 2 === 0 ? <InboxIcon /> : <MailIcon />}
            </ListItemIcon>
            <ListItemText primary={text} />
          </ListItem>
        ))}
      </List>
      <Divider />
      <List>
        {["All mail", "Trash", "Spam"].map((text, index) => (
          <ListItem button key={text}>
            <ListItemIcon>
              {index % 2 === 0 ? <InboxIcon /> : <MailIcon />}
            </ListItemIcon>
            <ListItemText primary={text} />
          </ListItem>
        ))}
      </List>
    </div>
  );
  useEffect(() => {
    const keepMenuOpen = true;
    if (keepMenuOpen) {
      toggleDrawer("right", true);
    }
  });
  return (
    <div className={styles.toggleMazeOptionsUi}>
      {/* Make icon instead */}
      {/* <div
        className={styles.toggleMazeOptionsUiButton}
        onClick={toggleDrawer("left", true)}
      >
        <Typography variant="h5">Maze Generator</Typography>
      </div> */}
      <div
        className={styles.toggleMazeOptionsUiButton}
        onClick={toggleDrawer("left", true)}
      ></div>
      <IconButton
        className={menuClassStyles.menuButton}
        color="inherit"
        aria-label="menu"
      >
        <AppIcon />
      </IconButton>
      <Button onClick={toggleDrawer("left", true)}>
        <Typography>Left</Typography>
      </Button>
      <Button onClick={toggleDrawer("right", true)}>
        <Typography>Right</Typography>
      </Button>
      {/* <Button onClick={toggleDrawer('top', true)}>Open Top</Button>
      <Button onClick={toggleDrawer('bottom', true)}>Open Bottom</Button> */}
      <SwipeableDrawer
        transitionDuration={2}
        open={state.left}
        onClose={toggleDrawer("left", false)}
        onOpen={toggleDrawer("left", true)}
      >
        {sideList("left")}
      </SwipeableDrawer>
      <SwipeableDrawer
        anchor="top"
        open={state.top}
        transitionDuration={1}
        onClose={toggleDrawer("top", false)}
        onOpen={toggleDrawer("top", true)}
      >
        {fullList("top")}
      </SwipeableDrawer>
      <SwipeableDrawer
        anchor="bottom"
        transitionDuration={3}
        open={state.bottom}
        onClose={toggleDrawer("bottom", false)}
        onOpen={toggleDrawer("bottom", true)}
      >
        {fullList("bottom")}
      </SwipeableDrawer>
      <SwipeableDrawer
        anchor="right"
        open={state.right}
        onClose={toggleDrawer("right", false)}
        onOpen={toggleDrawer("right", true)}
      >
        {sideList("right")}
      </SwipeableDrawer>
    </div>
  );
}
