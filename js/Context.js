import React, { Component } from 'react';
import { Actions } from 'react-native-router-flux';

var baseUrl = 'http://192.168.1.61:3101'

export const AppContext = React.createContext();


export class AppProvider extends Component {
  constructor(props) {
    super(props);
    this.state = {
      loggedIn: false,
      user: [],
      avatar: '',

      users: [],
      objects: [],
      droppedObjs: [],
      organizedDroppedObjs: [],
      profileListSelect: 1,
      listSelect: 1,

      userLat: 0,
      userLong: 0,
      navError: false,

      objToDrop: [],
      objToSearch: {},
      objPosition: {}
    }
  }

  async componentDidMount() {

    const userResponse = await fetch(`${baseUrl}/users`)
    const objResponse = await fetch(`${baseUrl}/objects`)
    const droppedObjResponse = await fetch(`${baseUrl}/dropped_objects`)

    const userjson = await userResponse.json();
    const objjson = await objResponse.json();
    const droppedObjjson = await droppedObjResponse.json();
    const organizedDroppedObjs = await this.organizeDroppedObj(droppedObjjson.objects)

    this.setState({
      users: userjson.virgeo_users,
      objects: objjson.objects,
      droppedObjs: droppedObjjson.objects,
      objToSearch: organizedDroppedObjs[0],
    })
  }



  logIn = (userId) =>{
    fetch(`${baseUrl}/users/${userId}`)
      .then(response => response.json())
      .then(json => {
        let avatar = json.user[0].avatar_info[0].avatar_name

        return this.setState({
          user: json.user,
          loggedIn: true,
          avatar: avatar,
        })
      })
      .then(()=>{
        Actions.profile()
      })
  }

  logOut = () =>{
    this.setState({
      loggedIn: false,
      user: [],
      avatar: '',
      userLat: 0,
      userLong: 0,
      navError: false,
      objToDrop: [],
      objToSearch: [],
    })
    Actions.login()
  }

  fetchDroppedObjs(){
    fetch(`${baseUrl}/dropped_objects`)
      .then(response => response.json())
      .then(json => {
        this.setState({
          droppedObjs: json.objects
        })
      })
  }

  fetchUser(userId){
    fetch(`${baseUrl}/users/${userId}`)
      .then(response => response.json())
      .then(json => {
        this.setState({
          user: json.user,
        })
      })
  }

  calculatedObjPos = (objPosition) =>{
    this.setState({
      objPosition: objPosition
    })
  }

  organizeDroppedObj = (objs) =>{
    var toBeOrganized;
    if (this.state.organizedDroppedObjs === []){
      toBeOrganized = this.state.droppedObjs
    } else {
      toBeOrganized = objs
    }

    navigator.geolocation.watchPosition(
      (position) => {
        let userLat = position.coords.latitude
        let userLong = position.coords.longitude

        let calcDistance = 0
        for(let i=0; i< toBeOrganized.length;i++){
          calcDistance = latLongToDistanceAway(userLat, userLong, toBeOrganized[i].latitude, toBeOrganized[i].longitude)
          toBeOrganized[i].distance = calcDistance
        }
        var organized = selectionSort(toBeOrganized)
        console.log('organized', organized)
        this.setState({
          organizedDroppedObjs: organized,
          userLat: userLat,
          userLong: userLong,
        })

      return organized

      },
      (error) => this.setState({ navError: true }),
      { enableHighAccuracy: true, distanceFilter: 1, timeout: 10000, maximumAge: 10000 },
    )

    return 'done'

    function selectionSort(array){
      for(var i = 0; i < array.length; i++){
        var min = i;
        for(var j = i+1; j < array.length; j++){
          if(array[j].distance < array[min].distance){
           min = j;
          }
        }
        var temp = array[i];
        array[i] = array[min];
        array[min] = temp;
      }
      return array;
    };

    function latLongToDistanceAway(lat1, long1, lat2, long2){
      var radiusEarth = 6371e3;

      //convert degrees to radians
      var lat1r = (lat1 * Math.PI)/180
      var lat2r = (lat2 * Math.PI)/180

      //difference lat and difference long in radians
      var dlat = (lat2 - lat1) * Math.PI / 180
      var dlong = (long2 - long1) * Math.PI / 180

      var a = Math.sin(dlat/2) * Math.sin(dlat/2) + Math.cos(lat1r) * Math.cos(lat2r) * Math.sin(dlong/2) * Math.sin(dlong/2);
      var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return radiusEarth * c
    }
  }

  listSelectFunc = (objId) =>{
    var objToSearch = {}

    for(let i=0; i < this.state.droppedObjs.length; i++){
      if(objId === this.state.droppedObjs[i].id){
        objToSearch = this.state.droppedObjs[i]
      }
    }

    this.setState({
      listSelect: objId,
      objToSearch: objToSearch
    })
  }

  profileListSelectFunc = (objId) =>{
    var objToDrop = {}
    var userObjects = this.state.user[0].objects

    console.log('obj to drop', objId)
    for(let i=0; i < userObjects.length; i++){
      if(objId === userObjects[i].object_id){
        objToDrop = userObjects[i]
      }
    }

    console.log('this.state.obj' , 'obj to drop', objToDrop)
    this.setState({
      profileListSelect: objId,
      objToDrop: objToDrop
    })
  }

  dropObj(objToDrop){
    let userObjId = objToDrop.user_object_id

    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.setState({
          userLat: position.coords.latitude,
          userLong: position.coords.longitude,
        })

        let obj = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          object_id: objToDrop.user_object_id
        }
        return obj
      },
      (error) => this.setState({ navError: true }),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 },
    ).then((obj)=>{
      return fetch(`${baseUrl}/dropped_objects`, {
        method: 'POST',
        body: JSON.stringify(obj),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        }
      })
    })
    .then(()=>{
      return this.fetchDroppedObjs()
    })
    .then(()=>{
      return fetch(`${baseUrl}/user_objects/${userObjId}`, {
        method: 'DELETE',
      })
    })
    .then(()=>{
      return this.fetchUser(this.state.user.virgeo_user_id)
    })
  }

  pickUpObj(objToPickUp){
    let userObjId = objToPickUp.id
    let obj = {
      virgeo_user_id: this.state.user[0].virgeo_user_id,
      object_id: this.state.user[0].objects.object_id,
    }

    fetch(`${baseUrl}/user_objects`, {
      method: 'POST',
      body: JSON.stringify(obj),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      }
    })
    .then(()=>{
      return this.fetchUser(this.state.user[0].virgeo_user_id)
    })
    .then(()=>{
      return fetch(`${baseUrl}/dropped_objects/${userObjId}`, {
        method: 'DELETE',
      })
    })
    .then(()=>{
      return this.fetchDroppedObjs()
    })
  }


  render() {
    const { children } = this.props;

    return (
      <AppContext.Provider
        value={{
          loggedIn: this.state.loggedIn,
          user: this.state.user,
          userLat: this.state.userLat,
          userLong: this.state.userLong,
          avatar: this.state.avatar,

          users: this.state.users,
          objects: this.state.objects,
          droppedObjs: this.state.droppedObjs,
          organizedDroppedObjs: this.state.organizedDroppedObjs,
          listSelect: this.state.listSelect,
          profileListSelect: this.state.profileListSelect,

          objToDrop: this.state.objToDrop,
          objToSearch: this.state.objToSearch,
          objPosition: this.state.objPosition,

          logIn: this.logIn,
          logOut: this.logOut,
          pickUpObj: this.pickUpObj,
          dropObj: this.dropObj,
          calculatedObjPos: this.calculatedObjPos,
          organizeDroppedObj: this.organizeDroppedObj,
          listSelectFunc: this.listSelectFunc,
          profileListSelectFunc: this.profileListSelectFunc
        }}
      >
        {children}
      </AppContext.Provider>
    );
  }
}

export const AppConsumer = AppContext.Consumer;
