import { createContext, useContext } from 'react';

/**
 * True when a master page is shown as a tab of Fabric Masters: the tab page
 * owns the title and the guide, so the page drops its own title block and
 * breadcrumb and keeps only its toolbar.
 */
export const FabricMastersEmbed = createContext(false);

export const useFabricMastersEmbed = () => useContext(FabricMastersEmbed);
