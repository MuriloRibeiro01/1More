import { useFonts } from 'expo-font';
import { RacingSansOne_400Regular } from '@expo-google-fonts/racing-sans-one';
import { Barlow_400Regular, Barlow_500Medium, Barlow_600SemiBold, Barlow_700Bold } from '@expo-google-fonts/barlow';
import { BarlowCondensed_700Bold, BarlowCondensed_800ExtraBold } from '@expo-google-fonts/barlow-condensed';
import { IBMPlexMono_500Medium, IBMPlexMono_600SemiBold } from '@expo-google-fonts/ibm-plex-mono';

// Só os pesos usados pelo Design System. No RN o peso vem do fontFamily:
// nunca combine fontWeight com estas fontes.
export function useOneMoreFonts() {
  return useFonts({ RacingSansOne_400Regular, Barlow_400Regular, Barlow_500Medium, Barlow_600SemiBold, Barlow_700Bold,
    BarlowCondensed_700Bold, BarlowCondensed_800ExtraBold, IBMPlexMono_500Medium, IBMPlexMono_600SemiBold });
}
