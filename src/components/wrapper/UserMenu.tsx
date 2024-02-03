import React from "react";
import { ApiHelper } from "../../helpers/ApiHelper";
import { UserHelper } from "../../helpers/UserHelper";
import { Avatar, Menu, Typography, Icon, Button, Box, Tabs, Tab, Divider } from "@mui/material";
import { NavItem, AppList } from ".";
import { LoginUserChurchInterface, UserContextInterface } from "@churchapps/helpers";
import { ChurchList } from "./ChurchList";
import { SupportModal } from "../SupportModal";
import { CommonEnvironmentHelper } from "../../helpers/CommonEnvironmentHelper";
import { TabPanel } from "../TabPanel";
import { NavLink } from "react-router-dom";


interface Props {
  userName: string;
  profilePicture: string;
  userChurches: LoginUserChurchInterface[];
  currentUserChurch: LoginUserChurchInterface;
  context: UserContextInterface;
  appName: string;
  router?: any;
}

export const UserMenu: React.FC<Props> = (props) => {
  const userName = props.userName;
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [showSupport, setShowSupport] = React.useState(false);
  const open = Boolean(anchorEl);

  const handleClick = (e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
    setAnchorEl(e.currentTarget);
  };

  const handleClose = () => {
    setTabIndex(0);
    setAnchorEl(null);
  };

  const getMainLinks = () => {
    const jwt = ApiHelper.getConfig("MembershipApi").jwt;
    const churchId = UserHelper.currentUserChurch.church.id;
    let result: JSX.Element[] = [];
    if (props.appName === "CHUMS") result.push(<NavItem url={"/profile"} key="/profile" label="Profile" icon="person" router={props.router} />);
    else result.push(<NavItem url={`${CommonEnvironmentHelper.ChumsRoot}/login?jwt=${jwt}&churchId=${churchId}&returnUrl=/profile`} key="/profile" label="Profile" icon="person" external={true} router={props.router} />);
    result.push(<NavItem url="/logout" label="Logout" icon="logout" key="/logout" router={props.router} />);
    result.push(<NavItem label="Support" key="Support" icon="help" onClick={() => { setShowSupport(true) }} />);
    result.push(<div style={{borderTop:"1px solid #CCC", paddingTop:2, paddingBottom:2}}></div>)
    result.push(<NavItem label="Switch App" key="Switch App" icon="apps" onClick={() => { setTabIndex(1); }} />);
    if (props.userChurches.length > 1) result.push(<NavItem label="Switch Church" key="Switch Church" icon="church" onClick={() => { setTabIndex(2); }} />);
    return result;
  }

  const getProfilePic = () => {
    if (props.profilePicture) return props.profilePicture
    else return "/images/sample-profile.png";
  }

  const paperProps = {
    elevation: 0,
    sx: {
      overflow: "visible",
      filter: "drop-shadow(0px 2px 8px rgba(0,0,0,0.32))",
      mt: 1.5,
      "& .MuiAvatar-root": { width: 32, height: 32, ml: -0.5, mr: 1 },
      minWidth: 450
    }
  };

  const handleItemClick = (e: React.MouseEvent<HTMLDivElement>) => {
    console.log(e);
  }

  const [tabIndex, setTabIndex] = React.useState(0);

  const getTabs = () => (
    <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
      <TabPanel value={tabIndex} index={0}>
        {getMainLinks()}
      </TabPanel>
      <TabPanel value={tabIndex} index={1}>
        <NavItem label="Back" key="AppBack" icon="arrow_back" onClick={() => { setTabIndex(0); }} />
        <AppList currentUserChurch={props.currentUserChurch} appName={props.appName} />
      </TabPanel>
      {props.userChurches.length > 1 && <TabPanel value={tabIndex} index={2}>
        <NavItem label="Back" key="ChurchBack" icon="arrow_back" onClick={() => { setTabIndex(0); }} />
        <ChurchList userChurches={props.userChurches} currentUserChurch={props.currentUserChurch} context={props.context} />
      </TabPanel>}

    </Box>
  );

  return (
    <>
      {showSupport && <SupportModal onClose={() => setShowSupport(false)} appName={props.appName} />}
      <Button onClick={handleClick} color="inherit" aria-controls={open ? "account-menu" : undefined} aria-haspopup="true" aria-expanded={open ? "true" : undefined} style={{ textTransform: "none" }} endIcon={<Icon>expand_more</Icon>}>
        <Avatar src={getProfilePic()} sx={{ width: 32, height: 32, marginRight: 1 }}></Avatar>
        <Typography color="inherit" noWrap>{userName}</Typography>
      </Button>

      <Menu anchorEl={anchorEl} id="account-menu" open={open} onClose={handleClose} onClick={(e) => { handleItemClick(e) }} PaperProps={paperProps} transformOrigin={{ horizontal: "right", vertical: "top" }} anchorOrigin={{ horizontal: "right", vertical: "bottom" }} sx={{ "& .MuiBox-root": { borderBottom: 0 } }}>
        {getTabs()}
      </Menu>
    </>
  );
};
