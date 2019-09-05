from starlette.applications import Starlette
from starlette.staticfiles import StaticFiles
from starlette.requests import Request
from starlette.responses import JSONResponse, FileResponse, StreamingResponse, RedirectResponse
from starlette.middleware.sessions import SessionMiddleware
from starlette.middleware.gzip import GZipMiddleware

import base64
import urllib.parse
import sys

import uvicorn

import irodshelper


app = Starlette()
app.debug = True
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(SessionMiddleware, secret_key="t6dX0AkQOcJ7+6X2c1JUoAzhZ27LHr6QS+8DuYOye1E=")

# website >>
app.mount('/static', StaticFiles(directory="client/build/static"))

@app.route('/')
def index(request):
    return FileResponse("./client/build/index.html")

@app.route('/favicon.ico')
def favicon(request):
    return FileResponse("./client/build/favicon.ico")
    
@app.route('/manifest.json')
def manifest(request):
    return FileResponse("./client/build/manifest.json")

@app.route('/auth/status')
def auth_status(request):
    is_authenticated = "irods_user_name" in request.session and 'irods_password' in request.session and len(request.session["irods_user_name"])!=0 and len(request.session["irods_password"])!=0
    return JSONResponse({"authenticated": is_authenticated})
    
@app.route('/auth/login', methods=["POST"])
async def login(request):
    payload = await request.json()
    try:
        irodshelper.login({"irods_user_name": payload['username'], "irods_password": payload['password']})
        request.session["irods_user_name"] = payload['username']
        request.session["irods_password"] = payload['password']
        return JSONResponse({"login": True})
    except:
        return JSONResponse({"error": "Invalid credentials. [{}]".format(sys.exc_info()[1])}, 403)

@app.route('/auth/logout')
async def logout(request):
    request.session.clear()
    return RedirectResponse(url='/')
# << website

# iRODS API >>
@app.route('/irods/list')
def irods_list(request):
    try:
        payload = request.query_params.get("path", "/")
        response = irodshelper.get_serialized_collection(payload, request.session)
        return JSONResponse(response)
    except Exception as exception:
        return JSONResponse({"error": exception}, 400)

@app.route('/irods/data-object')
def irods_data_object(request):
    payload = request.query_params.get("path", None)
    print("imeta ",payload)
    #quick sanity check
    if not payload:
        return JSONResponse({"error": "Invalid or empty iRODSDataObject path."}, 400)
    
    response = irodshelper.get_serialized_data_object(payload)
    return JSONResponse(response)

@app.route('/irods/search', methods=["POST"])
async def irods_query(request):
    payload = await request.json()
    search_type = payload['type']
    print(payload)
    #study_id 2136
    search = {
        "iRODSCollection": irodshelper.search_collection,
        "iRODSCollectionMeta": irodshelper.search_collection_metadata,
        "iRODSDataObject": irodshelper.search_data_object,
        "iRODSDataObjectMeta": irodshelper.search_data_object_metadata
    }
    result = search[search_type](payload, request.session)
    return JSONResponse(result)

def read_in_chunks(data_object, chunk_size=1024):
    """Lazy function (generator) to read a file piece by piece.
    Default chunk size: 1Ki."""
    with data_object.open('r') as f:
        while True:
            data = f.read(chunk_size)
            if not data:
                break
            yield data

@app.route('/irods/download')
def irods_download_data_object(request):
    payload = request.query_params.get("path", None)
    data_object = irodshelper.get_data_object(payload, request.session)

    #quick sanity check
    if not payload or not data_object:
        return JSONResponse({"error": "iRODSDataObject not found. Requested path: {0}".format(payload)}, 400)
    
    return StreamingResponse(
        read_in_chunks(data_object),
        headers={
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': 'attachment; filename="{}"'.format(payload.split("/")[-1])
        }
    )

# << iRODS API

if __name__ == '__main__':
    uvicorn.run(app, host='0.0.0.0', port=8000)