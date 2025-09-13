import { HybridParser } from './src/hybridParser';
import { ClaimsParser } from './src/claimsParser';

async function debugUserData() {
    console.log('=== DEBUG: Testing user data structure ===');
    
    const config = {
        rxTbaPath: 'rxTba',
        rxHistoryPath: 'rxHistory',
        medHistoryPath: 'medHistory',
        dateFormat: 'YYYY-MM-DD',
        colors: {
            rxTba: '#FF6B6B',
            rxHistory: '#4ECDC4',
            medHistory: '#45B7D1'
        }
    };
    
    const parser = new ClaimsParser(config);
    
    try {
        console.log('\n--- Testing ClaimsParser with user data ---');
        const result = await parser.parseFile('debug-user-data.json');
        
        console.log('Total claims:', result.claims.length);
        console.log('Claim types:', result.metadata.claimTypes);
        
        // Group by type
        const byType = result.claims.reduce((acc, claim) => {
            acc[claim.type] = (acc[claim.type] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        
        console.log('Claims by type:', byType);
        
        // Show all claims
        result.claims.forEach((claim, index) => {
            console.log(`Claim ${index + 1}:`, {
                id: claim.id,
                type: claim.type,
                displayName: claim.displayName,
                startDate: claim.startDate.toISOString().split('T')[0],
                endDate: claim.endDate.toISOString().split('T')[0]
            });
        });
        
        console.log('\n--- Testing HybridParser with user data ---');
        const hybridParser = new HybridParser();
        const hybridResult = await hybridParser.parseFile('debug-user-data.json');
        
        console.log('HybridParser total claims:', hybridResult.claims.length);
        const hybridByType = hybridResult.claims.reduce((acc, claim) => {
            acc[claim.type] = (acc[claim.type] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        console.log('HybridParser claims by type:', hybridByType);
        
        const strategy = await hybridParser.getParsingStrategy('debug-user-data.json');
        console.log('Strategy used:', strategy);
        
    } catch (error) {
        console.error('Error:', error);
        if (error instanceof Error) {
            console.error('Stack:', error.stack);
        }
    }
}

debugUserData();