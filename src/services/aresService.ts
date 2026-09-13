export interface AresResponse {
  ico: string;
  obchodniJmeno: string;
  sidlo: {
    textovaAdresa: string;
  };
  dic?: string;
}

export const fetchAresData = async (ico: string): Promise<AresResponse> => {
  // Očištění IČO - odstranění mezer
  const cleanIco = ico.replace(/\s+/g, '');
  
  if (cleanIco.length !== 8) {
    throw new Error('IČO musí mít přesně 8 znaků.');
  }

  try {
    const response = await fetch(`https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${cleanIco}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Subjekt s tímto IČO nebyl nalezen.');
      }
      throw new Error(`Chyba API: ${response.statusText}`);
    }

    const data = await response.json();
    return data as AresResponse;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Chyba při komunikaci s ARES.');
  }
};
