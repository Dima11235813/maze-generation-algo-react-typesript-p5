import React, { useContext } from "react";
// import PropTypes from "prop-types";
import AppBar from "@material-ui/core/AppBar";
import Toolbar from "@material-ui/core/Toolbar";

import Typography from "@material-ui/core/Typography";
import CssBaseline from "@material-ui/core/CssBaseline";

import useScrollTrigger from "@material-ui/core/useScrollTrigger";
import Slide from "@material-ui/core/Slide";

import IconButton from "@material-ui/core/IconButton";
import MenuIcon from "@material-ui/icons/Menu";

//Components
import ExpandSideBar from "../../components/ExpandSidebar";
import { NavLink } from "react-router-dom";
import { APP_ROUTES, MAIN_MENU_OPTIONS } from "../../utils/routeUtils";
import { makeStyles, createStyles, Theme, Button } from "@material-ui/core";

import styles from "./Header.module.scss";
import { mazeOptionsUiContext, p5_MazeContext } from "../../AppContext";
import { MazeViewStore } from "../../stores/MazeViewStore";
import { inject, observer } from "mobx-react";

interface HeaderProps {
  mazeViewStore?: MazeViewStore;
}

const useStyles = makeStyles((theme: Theme) =>
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

function HideOnScroll(props: any) {
  const { children, window } = props;
  // Note that you normally won't need to set the window ref as useScrollTrigger
  // will default to window.
  // This is only being set here because the demo is in an iframe.
  const trigger = useScrollTrigger({ target: window ? window() : undefined });

  return (
    <Slide appear={false} direction="down" in={!trigger}>
      {children}
    </Slide>
  );
}
//Button to show and hit TODO

// HideOnScroll.propTypes = {
//   children: PropTypes.element.isRequired,
//   /**
//    * Injected by the documentation to work in an iframe.
//    * You won't need it on your project.
//    */
//   window: PropTypes.func
// };

const Header = (props: HeaderProps) => {
  const classes = useStyles();
  const mazeContext = useContext(p5_MazeContext);
  const { changeView } = props.mazeViewStore!;
  return (
    <div className={classes.root}>
      <CssBaseline />
      <HideOnScroll {...props}>
        <AppBar>
          <Toolbar>
            <IconButton
              edge="start"
              className={classes.menuButton}
              color="inherit"
              aria-label="menu"
            >
              <MenuIcon />
            </IconButton>
            <NavLink
              to={APP_ROUTES.LOGIN}
              className={styles.NavLink}
              activeClassName={styles.SelectedLink}
            >
              {APP_ROUTES.LOGIN.toUpperCase()}
            </NavLink>
            <NavLink
              to={APP_ROUTES.MAZE}
              className={styles.NavLink}
              activeClassName={styles.SelectedLink}
            >
              {APP_ROUTES.MAZE.toUpperCase()}
            </NavLink>
            <Button
              onClick={() => {
                changeView();
              }}
              color="inherit"
            >
              <Typography>
                {MAIN_MENU_OPTIONS.ENABLE_FOLLOW_CELL_CREATOR}
              </Typography>
            </Button>
            <Button color="inherit">
              <Typography>{MAIN_MENU_OPTIONS.SAVE}</Typography>
            </Button>
            <ExpandSideBar />
          </Toolbar>
        </AppBar>
      </HideOnScroll>
      <Toolbar />
    </div>
  );
};
export default inject("mazeViewStore")(observer(Header));
