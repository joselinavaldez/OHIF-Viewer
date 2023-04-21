function getQueryParamServer() {
  const searchParams = new URLSearchParams(window.location.search);
  const server = searchParams.get('server');
  if (server) {
    return {
      name: 'PAC',
      wadoUriRoot: `${server}/wado`,
      qidoRoot: `${server}/dicom-web`,
      wadoRoot: `${server}/dicom-web`,
      qidoSupportsIncludeField: true,
      imageRendering: 'wadouri',
      thumbnailRendering: 'wadouri',
      enableStudyLazyLoad: true,
      supportsFuzzyMatching: true,
    };
  }
  return undefined;
}

function getWrappedqueryParamServer() {
  const server = getQueryParamServer();
  if (server)
    return {
      dicomWeb: [server],
    };
  return undefined;
}

export { getQueryParamServer, getWrappedqueryParamServer };
