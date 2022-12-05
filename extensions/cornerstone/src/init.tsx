import OHIF from '@ohif/core';
import React from 'react';

import * as cornerstone from '@cornerstonejs/core';
import * as cornerstoneTools from '@cornerstonejs/tools';
import {
  init as cs3DInit,
  eventTarget,
  EVENTS,
  metaData,
  volumeLoader,
  imageLoader,
  imageLoadPoolManager,
  Settings,
} from '@cornerstonejs/core';
import { Enums, utilities, ReferenceLinesTool } from '@cornerstonejs/tools';
import {
  cornerstoneStreamingImageVolumeLoader,
  sharedArrayBufferImageLoader,
} from '@cornerstonejs/streaming-image-volume-loader';

import initWADOImageLoader from './initWADOImageLoader';
import initCornerstoneTools from './initCornerstoneTools';

import { connectToolsToMeasurementService } from './initMeasurementService';
import initCineService from './initCineService';
import interleaveCenterLoader from './utils/interleaveCenterLoader';
import nthLoader from './utils/nthLoader';
import interleaveTopToBottom from './utils/interleaveTopToBottom';
import initContextMenu from './initContextMenu';

// TODO: Cypress tests are currently grabbing this from the window?
window.cornerstone = cornerstone;
window.cornerstoneTools = cornerstoneTools;
/**
 *
 */
export default async function init({
  servicesManager,
  commandsManager,
  configuration,
  appConfig,
}) {
  await cs3DInit();

  // For debugging e2e tests that are failing on CI
  cornerstone.setUseCPURendering(Boolean(appConfig.useCPURendering));

  // For debugging large datasets
  const MAX_CACHE_SIZE_1GB = 1073741824;
  const maxCacheSize = appConfig.maxCacheSize;
  cornerstone.cache.setMaxCacheSize(
    maxCacheSize ? maxCacheSize : MAX_CACHE_SIZE_1GB
  );

  initCornerstoneTools();

  Settings.getRuntimeSettings().set(
    'useCursors',
    Boolean(appConfig.useCursors)
  );

  const {
    UserAuthenticationService,
    customizationService,
    DisplaySetService,
    UIModalService,
    UINotificationService,
    CineService,
    CornerstoneViewportService,
    HangingProtocolService,
    ToolGroupService,
    ViewportGridService,
  } = servicesManager.services;

  window.services = servicesManager.services;

  if (!window.crossOriginIsolated) {
    UINotificationService.show({
      title: 'Cross Origin Isolation',
      message:
        'Cross Origin Isolation is not enabled, volume rendering will not work (e.g., MPR)',
      type: 'warning',
    });
  }

  if (cornerstone.getShouldUseCPURendering()) {
    _showCPURenderingModal(UIModalService, HangingProtocolService);
  }

  const labelmapRepresentation =
    cornerstoneTools.Enums.SegmentationRepresentations.Labelmap;

  cornerstoneTools.segmentation.config.setGlobalRepresentationConfig(
    labelmapRepresentation,
    {
      fillAlpha: 0.3,
      fillAlphaInactive: 0.2,
      outlineOpacity: 1,
      outlineOpacityInactive: 0.65,
    }
  );

  const metadataProvider = OHIF.classes.MetadataProvider;

  volumeLoader.registerVolumeLoader(
    'cornerstoneStreamingImageVolume',
    cornerstoneStreamingImageVolumeLoader
  );

  HangingProtocolService.registerImageLoadStrategy(
    'interleaveCenter',
    interleaveCenterLoader
  );
  HangingProtocolService.registerImageLoadStrategy(
    'interleaveTopToBottom',
    interleaveTopToBottom
  );
  HangingProtocolService.registerImageLoadStrategy('nth', nthLoader);

  imageLoader.registerImageLoader(
    'streaming-wadors',
    sharedArrayBufferImageLoader
  );

  metaData.addProvider(metadataProvider.get.bind(metadataProvider), 9999);

  imageLoadPoolManager.maxNumRequests = {
    interaction: appConfig?.maxNumRequests?.interaction || 100,
    thumbnail: appConfig?.maxNumRequests?.thumbnail || 75,
    prefetch: appConfig?.maxNumRequests?.prefetch || 10,
  };

  initWADOImageLoader(UserAuthenticationService, appConfig);

  initCineService(CineService);

  // When a custom image load is performed, update the relevant viewports
  HangingProtocolService.subscribe(
    HangingProtocolService.EVENTS.CUSTOM_IMAGE_LOAD_PERFORMED,
    volumeInputArrayMap => {
      for (const entry of volumeInputArrayMap.entries()) {
        const [viewportId, volumeInputArray] = entry;
        const viewport = CornerstoneViewportService.getCornerstoneViewport(
          viewportId
        );

        CornerstoneViewportService.setVolumesForViewport(
          viewport,
          volumeInputArray
        );
      }
    }
  );

  initContextMenu({
    CornerstoneViewportService,
    customizationService,
    commandsManager,
  });

  const newStackCallback = evt => {
    const { element } = evt.detail;
    utilities.stackPrefetch.enable(element);
  };

  const resetCrosshairs = evt => {
    const { element } = evt.detail;
    const { viewportId, renderingEngineId } = cornerstone.getEnabledElement(
      element
    );

    const toolGroup = cornerstoneTools.ToolGroupManager.getToolGroupForViewport(
      viewportId,
      renderingEngineId
    );

    if (!toolGroup || !toolGroup._toolInstances?.['Crosshairs']) {
      return;
    }

    const mode = toolGroup._toolInstances['Crosshairs'].mode;

    if (mode === Enums.ToolModes.Active) {
      toolGroup.setToolActive('Crosshairs');
    } else if (mode === Enums.ToolModes.Passive) {
      toolGroup.setToolPassive('Crosshairs');
    } else if (mode === Enums.ToolModes.Enabled) {
      toolGroup.setToolEnabled('Crosshairs');
    }
  };

  function elementEnabledHandler(evt) {
    const { element } = evt.detail;
    element.addEventListener(EVENTS.CAMERA_RESET, resetCrosshairs);

    eventTarget.addEventListener(
      EVENTS.STACK_VIEWPORT_NEW_STACK,
      newStackCallback
    );
  }

  function elementDisabledHandler(evt) {
    const { element } = evt.detail;

    element.removeEventListener(EVENTS.CAMERA_RESET, resetCrosshairs);

    // TODO - consider removing the callback when all elements are gone
    // eventTarget.removeEventListener(
    //   EVENTS.STACK_VIEWPORT_NEW_STACK,
    //   newStackCallback
    // );
  }

  eventTarget.addEventListener(
    EVENTS.ELEMENT_ENABLED,
    elementEnabledHandler.bind(null)
  );

  eventTarget.addEventListener(
    EVENTS.ELEMENT_DISABLED,
    elementDisabledHandler.bind(null)
  );

  ViewportGridService.subscribe(
    ViewportGridService.EVENTS.ACTIVE_VIEWPORT_INDEX_CHANGED,
    ({ viewportIndex }) => {
      const viewportId = `viewport-${viewportIndex}`;
      const toolGroup = ToolGroupService.getToolGroupForViewport(viewportId);

      if (!toolGroup || !toolGroup._toolInstances?.['ReferenceLines']) {
        return;
      }

      // check if reference lines are active
      const referenceLinesEnabled =
        toolGroup._toolInstances['ReferenceLines'].mode ===
        Enums.ToolModes.Enabled;

      if (!referenceLinesEnabled) {
        return;
      }

      toolGroup.setToolConfiguration(
        ReferenceLinesTool.toolName,
        {
          sourceViewportId: viewportId,
        },
        true // overwrite
      );

      // make sure to set it to enabled again since we want to recalculate
      // the source-target lines
      toolGroup.setToolEnabled(ReferenceLinesTool.toolName);
    }
  );
}

function CPUModal() {
  return (
    <div>
      <p>
        Your computer does not have enough GPU power to support the default GPU
        rendering mode. OHIF has switched to CPU rendering mode. Please note
        that CPU rendering does not support all features such as Volume
        Rendering, Multiplanar Reconstruction, and Segmentation Overlays.
      </p>
    </div>
  );
}

function _showCPURenderingModal(UIModalService, HangingProtocolService) {
  const callback = progress => {
    if (progress === 100) {
      UIModalService.show({
        content: CPUModal,
        title: 'OHIF Fell Back to CPU Rendering',
      });

      return true;
    }
  };

  const { unsubscribe } = HangingProtocolService.subscribe(
    HangingProtocolService.EVENTS.HANGING_PROTOCOL_APPLIED_FOR_VIEWPORT,
    ({ progress }) => {
      const done = callback(progress);

      if (done) {
        unsubscribe();
      }
    }
  );
}
