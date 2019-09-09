import React from 'react';
import { List, Icon , Spin, notification, Drawer, Tag, Breadcrumb, Badge, Modal, Form, Input, Button} from "antd";
import { FixedSizeList } from 'react-window';
import "antd/dist/antd.css";

const HOST = "http://127.0.0.1:8000";

const iRODS = {
  Types: {
    Collection: "iRODSCollection",
    DataObject: "iRODSDataObject"
  }
};

const IconText = ({ type, text }) => (
  <span>
    <Icon type={type} style={{ marginRight: 8 }} />
    {text}
  </span>
);

const IconButton = ({ type, text, click }) => (
  <span onClick={click}>
    <Icon type={type} style={{ marginRight: 8 }} />
    {text}
  </span>
);

const IconLink = ({ type, text, link }) => {
  let open = () =>{
    window.open(link);
  }
  return (
  <span onClick={open}>
    <Icon type={type} style={{ marginRight: 8 }}/>
    {text}
  </span>)
};

class VirtualList extends React.Component {
  renderCollection = (row, item) =>{
    return (
      <List.Item 
        key={item.path} 
        style={row.style} 
        onClick={this.props.onItemClick.bind(null,item)}
        actions={[
          <IconButton type="zoom-in" text="Metadata" click={this.props.onItemClick.bind(null, item)} key="list-item-action-metadata"/>,
        ]}>
        <List.Item.Meta
          avatar={<Icon type="folder" theme="filled" style={{ fontSize: '32px' }}/>}
          title={<Tag size="small" color="purple">{item.name}</Tag>}
        />
      </List.Item>
    );
  }

  renderDataObject = (row, item) =>{
    return (
      <List.Item key={item.path} style={row.style}
        actions={[
          <IconText type="calendar" text={item.modified} key="list-item-action-modified"/>,
          <IconText type="diff" text={item.size} key="list-item-action-size"/>,
          <IconButton type="zoom-in" text="Metadata" click={this.props.onItemClick.bind(null, item)} key="list-item-action-metadata"/>,
          <IconLink type="cloud-download" text="Download" link={"http://127.0.0.1:8000/irods/download?path="+window.encodeURIComponent(item.path)} key="list-item-action-download"/>,
        ]}>
        <List.Item.Meta
          avatar={<Icon type="file"theme="filled" style={{ fontSize: '32px' }}/>}
          title={<Tag size="small" color="geekblue">{this.props.searching ? item.path : item.name}</Tag>}
        />
      </List.Item>
    );
  }

  renderRow = (row) => {
    const item = this.props.data.children[row.index];    
    return ((item.type === iRODS.Types.Collection) ? this.renderCollection(row, item) : this.renderDataObject(row, item));
  };
yarn
  render() {
    return (
        <List 
          bordered
          itemLayout="vertical"
          dataSource={this.data}
          loading={this.loading}>
          <FixedSizeList
            height={window.innerHeight-75}
            width={window.innerWidth}
            itemCount={this.props.data.count}
            itemSize={100}
            overscanCount={5}>
            {this.renderRow}
          </FixedSizeList>
        </List>
    );
  }
}

class App extends React.Component {
  
  constructor(props) {
    super(props);
    
    this.state = {
      seraching: false,
      data_object: {
        metadata:[]
      },
      data: [],
      path: '/',
      loading: true,
      login: {
        visible: false,
        working: false
      },
      search: ""
    };
  }

  componentDidMount() {
    this.params = window.location.search
    .slice(1)
    .split('&')
    .map(p => p.split('='))
    .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {});
  
    console.log(document.cookie);

    fetch("/auth/status")
      .then( response => response.json())
      .then( data => {
        if(data.authenticated){
          this.setState({login: {working:false, visible: false}});
          this.ils(this.params.path);
        }else{
          this.setState({login: {working:false, visible: true}});
        }
      })
      .catch(error => {
        this.setState({login: {working:false, visible: true}});
        this.notifyError(error)
      })

  }

  notifyError = description => {
    notification['error']({
      message: 'An error occurred',
      description: description,
    });
  };

  onItemClick = (item, event) =>{
    switch(item.type){
      case iRODS.Types.Collection:
        this.ils(item.path);
        break;
      case iRODS.Types.DataObject:
        this.info(item);
        break;
      default:
        console.log({item:item, event:event});
        break;
    }
  }

  breadcrumbs = () => {
    if(this.state.searching){
      return (<Breadcrumb separator={<Badge color={'purple'}/>}>
        <Breadcrumb.Item><Tag color="green">iRODS (ipwd)</Tag></Breadcrumb.Item>
        <Breadcrumb.Item>Search Results</Breadcrumb.Item>
        <Breadcrumb.Item><Badge text={this.state.data.count+ ' items'} color={'cyan'}/></Breadcrumb.Item>
      </Breadcrumb>);
    }

    let absPath = "";
    let crumbs = [{
      name: "root",
      href: `${HOST}/?path=/`
    }]

    // eslint-disable-next-line
    for(let collection of this.state.path.split("/")){
      if(!collection)
        continue;
      absPath += `/${collection}`;
      crumbs.push({
        name: collection,
        href: `${HOST}/?path=` + absPath
      });
    }
    return (
    <Breadcrumb separator={<Badge color={'purple'}/>}>
      <Breadcrumb.Item><Tag color="green">iRODS (ipwd)</Tag></Breadcrumb.Item>
      {crumbs.map((c,i) => {
        return <Breadcrumb.Item><a href={c.href}>{c.name} {i===crumbs.length-1 ? <Badge text={this.state.data.count+ ' items'} color={'cyan'}/> : ""}</a></Breadcrumb.Item>
      })}
    </Breadcrumb>);
  };

  ils = path =>{
      this.setState({loading: true});
      if(!path) path = '/';
      let url = `${HOST}/irods/list?path=` + window.encodeURIComponent(path);
      fetch(url)
        .then( response => response.json())
        .then( data => {
          if(data.error){
            this.setState({loading: false});
            this.notifyError(data.error)
            return;
          }
          this.setState({data: data, loading: false, path: path});
          window.history.pushState(data, path, `?path=${path}`);
        })
        .catch(error => {
          this.setState({data: {}, loading: false});
          this.notifyError(error)
        });
  };

  info = item =>{
    this.setState({loading: true});
    let url = `${HOST}/irods/data-object?path=` + window.encodeURIComponent(item.path);
    fetch(url)
      .then( response => response.json())
      .then( data => {
        if(data.error){
          this.setState({loading: false});
          this.notifyError(data.error)
          return;
        }
        this.setState({loading: false, data_object: {...data, visible: true}});
      })
      .catch(error => {
        this.setState({loading: false});
        this.notifyError(error)
      });
  };

  onDrawerClose = () => {
    this.setState({data_object:{...this.state.data_object, visible:false}});
  };


  handleLogin = (event) => {
    event.preventDefault();
    fetch(`${HOST}/auth/login`, {method: "POST", body: JSON.stringify({"username": this.state.login.username, "password": this.state.login.password})})
        .then( response => response.json())
        .then( data => {
          if(data.error){
            this.setState({login: {...this.state.login, working:false, visible:true}});
            this.notifyError(data.error)
            return;
          }
          this.setState({login: {...this.state.login, working:false, visible:false}});
          this.ils(this.params.path);
      })
      .catch(error => {
        this.notifyError(error)
        this.setState({login: {...this.state.login, working:false, visible:true}});
      });
  };

  handleCancel = () => {
    console.log('Clicked cancel button');
    this.setState({
      login: {...this.state.login, visible: false}
    });
  };

  handleUsernameChange = (event) =>{
    this.setState({login: {...this.state.login, username: event.target.value}});
  }
  handlePasswordChange = (event) =>{
    this.setState({login: {...this.state.login, password: event.target.value}});
  }

  handleLogout = () =>{
    window.location = `${HOST}/auth/logout`;
  }
  
  renderLoginForm() {
    return (
      <Form onSubmit={this.handleLogin} className="login-form">
        <Form.Item>
            <Input
              prefix={<Icon type="user" style={{ color: 'rgba(0,0,0,.25)' }} />}
              placeholder="Username"
              value={this.state.login.username}
              onChange={this.handleUsernameChange}
            />
        </Form.Item>
        <Form.Item>
            <Input
              prefix={<Icon type="lock" style={{ color: 'rgba(0,0,0,.25)' }} />}
              type="password"
              placeholder="Password"
              value={this.state.login.password}
              onChange={this.handlePasswordChange}
            />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" className="login-form-button" loading={this.state.login.working} style={{width: "100%"}}>
            Log in
          </Button>
        </Form.Item>
      </Form>
    );
  }


  clearSearch = () =>{
    this.setState({
      searching: false,
      search: ""
    });
    this.ils();
  }

  handleSearch = (event) => {
    this.setState({search: event.target.value});
  }

  onSearch = () =>{
    console.log("onSearch");

    if(this.state.search === ""){
      console.log("Empty Serach. Clearing...");
      this.clearSearch();
      return;
    }
    this.setState({loading:true});
    let url = `${HOST}/irods/search`;
    fetch(url, {method: "POST", body: this.state.search})
      .then( response => response.json())
      .then( data => {
        console.log("Search result", data);
        this.setState({data: data, searching: true, loading: false});
       })
      .catch(e => {
        this.setState({loading: false});
        console.error(e);
      });
  }

  render() {
    return (
      <Spin spinning={this.state.loading} delay={100}>
        {this.breadcrumbs()}
        <Input key="input-search" id="json" type="text" value={this.state.search} onChange={this.handleSearch}></Input>
        <Button key="search-button" size="small" icon="search" onClick={this.onSearch}>Search</Button>  
        <Button key="logout-button" icon="poweroff" size="small" onClick={this.handleLogout} visible={!this.state.login.visible}>Logout</Button>  
        <VirtualList data={this.state.data} searching={this.state.searching} download={this.handleDownload} onItemClick={this.onItemClick.bind(this)}/>
        <Drawer
          title={this.state.data_object.name}
          placement="right"
          closable={true}
          onClose={this.onDrawerClose}
          width={window.innerWidth*0.4}
          visible={this.state.data_object.visible}>
         <List
          size="small"
          header={<div>Metadata <Badge text={this.state.data_object.metadata.length+ ' values'} color={'cyan'}/> </div>}
          bordered
          dataSource={this.state.data_object.metadata}
          renderItem={item => 
          <List.Item>  
            <Tag>{item.name}</Tag>
            {item.value}
          </List.Item>}/>
        </Drawer>
        <Modal
          title="iRODS Login"
          visible={this.state.login.visible}
          footer={null}>
          {this.renderLoginForm()}
        </Modal>
      </Spin>
    );
  }
}

export default App;
