# iRODS Browser :mag_right::open_file_folder:
Web based iRODS browser. 

# Requirements
- python 3+
- yarn/npm

# Installing python libraries
- `pip install starlette`
- `pip install uvicorn`
# Installing web dependencies and build client
1. `cd client`
2. `yarn install`
3. `yarn run build`

# Run server
1. `uvicorn server:app`
2. Open web browser at http://127.0.0.0:8000
3. _Profit!_

# Built with
- [Starlette](https://www.starlette.io/)
- [Python API for iRODS](https://github.com/irods/python-irodsclient)
- [Ant.design](https://ant.design)
