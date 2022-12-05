import { eventTarget, Types, EVENTS } from '@cornerstonejs/core';
import { Enums } from '@cornerstonejs/tools';
import { setEnabledElement } from './state';

const cs3DToolsEvents = Enums.Events;

const showContextMenuDefault: Types.CommandCustomization = {
  commands: [
    {
      commandName: 'showViewerContextMenu',
      commandOptions: {
        menuName: 'cornerstoneContextMenu',
      },
      context: 'CORNERSTONE',
    },
  ],
};

function initContextMenu({
  CornerstoneViewportService,
  customizationService,
  commandsManager,
}): void {
  /**
   * Finds tool nearby event position triggered.
   *
   * @param {Object} commandsManager mannager of commands
   * @param {Object} event that has being triggered
   * @returns cs toolData or undefined if not found.
   */
  const findNearbyToolData = evt => {
    if (!evt?.detail) {
      return;
    }
    const { element, currentPoints } = evt.detail;
    return commandsManager.runCommand('getNearbyToolData', {
      element,
      canvasCoordinates: currentPoints?.canvas,
    });
  };

  const getShowContextMenu = (): Types.UICommand =>
    customizationService.getModeCustomization(
      'showContextMenu',
      showContextMenuDefault
    );

  const showContextMenu = (contextMenuProps): void => {
    customizationService.recordInteraction(
      getShowContextMenu(),
      contextMenuProps
    );
  };

  const onRightClick = event => {
    const nearbyToolData = findNearbyToolData(event);
    showContextMenu({
      event,
      nearbyToolData,
    });
  };

  // TODO No CS3D support yet
  // const onTouchPress = event => {
  //   showContextMenu({
  //     event,
  //     nearbyToolData: undefined,
  //     isTouchEvent: true,
  //   });
  // };

  const resetContextMenu = () => {
    commandsManager.runCommand('closeViewerContextMenu');
  };

  /*
   * Because click gives us the native "mouse up", buttons will always be `0`
   * Need to fallback to event.which;
   *
   */
  const contextMenuHandleClick = evt => {
    const mouseUpEvent = evt.detail.event;
    const isRightClick = mouseUpEvent.which === 3;

    const clickMethodHandler = isRightClick ? onRightClick : resetContextMenu;
    clickMethodHandler(evt);
  };

  // const cancelContextMenuIfOpen = evt => {
  //   if (CONTEXT_MENU_OPEN) {
  //     resetContextMenu();
  //   }
  // };

  function elementEnabledHandler(evt) {
    const { viewportId, element } = evt.detail;
    const viewportInfo = CornerstoneViewportService.getViewportInfo(viewportId);
    const viewportIndex = viewportInfo.getViewportIndex();
    // TODO check update upstream
    setEnabledElement(viewportIndex, element);

    element.addEventListener(
      cs3DToolsEvents.MOUSE_CLICK,
      contextMenuHandleClick
    );
  }

  function elementDisabledHandler(evt) {
    const { element } = evt.detail;

    element.removeEventListener(
      cs3DToolsEvents.MOUSE_CLICK,
      contextMenuHandleClick
    );
  }

  eventTarget.addEventListener(
    EVENTS.ELEMENT_ENABLED,
    elementEnabledHandler.bind(null)
  );

  eventTarget.addEventListener(
    EVENTS.ELEMENT_DISABLED,
    elementDisabledHandler.bind(null)
  );
}

export default initContextMenu;
