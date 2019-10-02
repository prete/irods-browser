import os

from irods.session import iRODSSession
from irods.models import DataObject, Collection, DataObjectMeta, CollectionMeta
from irods.column import Like, Between, Criterion

iRODSDataObject = "iRODSDataObject"
iRODSCollection = "iRODSCollection"
iRODSDataObjectMeta = "iRODSDataObjectMeta"
iRODSCollectionMeta = "iRODSCollectionMeta"

def new_session(config = {}):
    # get configuration from enviroment if no config found
    irods_host = config.get('irods_host', os.environ['irods_host'])
    irods_port = config.get('irods_port', os.environ['irods_port'])
    irods_zone_name = config.get('irods_zone_name', os.environ['irods_zone_name'])
    irods_user_name = config.get('irods_user_name', os.environ['irods_user_name'])
    irods_password = config.get('irods_password', os.environ['irods_password'])
    print("new session for", irods_user_name)
    return iRODSSession(host=irods_host, port=irods_port, user=irods_user_name, password=irods_password, zone=irods_zone_name, client_zone='/seq', )

def login(config):
    with new_session(config) as session:
        session.collections.get("/")
        return True

def sizeof_fmt(num, suffix='B'):
    for unit in ['','Ki','Mi','Gi','Ti']:
        if abs(num) < 1024.0:
            return "%3.1f%s%s" % (num, unit, suffix)
        num /= 1024.0
    return "%.1f%s%s" % (num, 'Yi', suffix)

def serialize_data_object(data_object, include_metadata=False):
    serialized = {
        "type": iRODSDataObject,
        "id": data_object.id,
        "name": data_object.name,
        "size": sizeof_fmt(data_object.size),
        "modified": data_object.modify_time.isoformat(),
        "path": data_object.path
    }
    if include_metadata:
        serialized["metadata"] = [{"name" : m.name, "value" : m.value, "units": m.units} for m in data_object.metadata.items()]

    return serialized

def serialize_collection(collection):
    subcollections = [{
        "type": iRODSCollection,
        "id": subcol.id,
        "name": subcol.name,
        "path": subcol.path
    } for subcol in collection.subcollections]
    
    data_objects = [serialize_data_object(obj) for obj in collection.data_objects]
    children = subcollections + data_objects
    return {
        "id": collection.id,
        "name": collection.name,
        "path": collection.path,
        "count": len(children),
        "children": children,
        "metadata": [{"name" : m.name, "value" : m.value, "units": m.units} for m in collection.metadata.items()]
    }

def parse_path(path: str):
    collection_path = "/".join(path.split("/")[:-1])
    file_name = path.split("/")[-1]
    return collection_path, file_name

def find_data_object(path, session):
    collection_path, file_name = parse_path(path)
    print("Find::DataObject", path, collection_path, file_name)    
    return [d for d in session.collections.get(collection_path).data_objects if d.name == file_name][0]

def get_data_object(path, config={}):
    print("Get::DataObject", path)
    with new_session(config) as session:
        data_object = find_data_object(path, session)
        return data_object

def get_serialized_collection(path, config={}):
    with new_session(config) as session:
        collection = session.collections.get(path)
        return serialize_collection(collection)

def get_serialized_data_object(path, config={}):
    with new_session(config) as session:
        data_object = find_data_object(path, session)
        return serialize_data_object(data_object, include_metadata=True)


# search methods >>

def search_data_object(q, config={}):
    print("Search::DataObject", q)
    with new_session(config) as session:
        query = session.query(DataObject, Collection.name) \
            .filter(Like(DataObject.path, "/irods-seq-sr%")) \
            .filter(Criterion('=', DataObject.name, '%{}%'.format(q['value']))) \
            .add_keyword('zone', 'seq')

        results = [{
            "type": iRODSDataObject,
            "id": result[DataObject.id],
            "name": result[DataObject.name],
            "size": sizeof_fmt(result[DataObject.size]),
            "modified": result[DataObject.modify_time].isoformat(),
            "path": "{}/{}".format(result[Collection.name], result[DataObject.name])
        } for result in query]
        
        return {
            "id": "search-result",
            "name": q['value'],
            "count": len(results),
            "children": results
        }

def search_data_object_metadata(q, config={}):
    print("Search::DataObjectMeta", q)
    with new_session(config) as session:
        query = session.query(DataObject, Collection.name) \
            .filter(Like(DataObject.path, "/irods-seq-sr%")) \
            .add_keyword('zone', 'seq')

        print("Searching for", q)

        for k in q:
           query = query.filter(Criterion('=', DataObjectMeta.name, k)) \
                .filter(Criterion('=', DataObjectMeta.value, q[k]))

        return [{
            "type": iRODSDataObject,
            "id": result[DataObject.id],
            "name": result[DataObject.name],
            "size": sizeof_fmt(result[DataObject.size]),
            "modified": result[DataObject.modify_time].isoformat(),
            "path": "{}/{}".format(result[Collection.name], result[DataObject.name])
        } for result in query]

def search_collection(q, config={}):
    print("Search::Collection", q)
    with new_session(config) as session:
        query = session.query(Collection, CollectionMeta) \
            .filter(Like(Collection.name, '%{}%'.format(q['value']))) \
            .add_keyword('zone', 'seq')

        return [{
            "type": iRODSCollection,
            "id": result[Collection.id],
            "name": result[Collection.name]
        } for result in query]

def search_collection_metadata(q, config={}):
    print("Search::CollectionMeta", q)
    with new_session(config) as session:
        query = session.query(Collection, CollectionMeta) \
            .add_keyword('zone', 'seq')

        for k in q:
            query = query.filter(Criterion('=', CollectionMeta.name, k)) \
                .filter(Criterion('=', CollectionMeta.value, q[k]))
 
        return [{
            "type": iRODSCollection,
            "id": result[Collection.id],
            "name": result[Collection.name]
        } for result in query]

# << search methods