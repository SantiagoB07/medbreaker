/**
 * Test script for Green Agent tools
 * Run with: npx ts-node scripts/test-tools.ts
 */

import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api';

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL || 'https://joyous-retriever-30.convex.cloud';

async function testTools() {
  console.log('🧪 Testing Green Agent Tools\n');
  console.log('Convex URL:', CONVEX_URL);
  
  const convex = new ConvexHttpClient(CONVEX_URL);

  // Test 1: Search Procedures
  console.log('\n--- TEST 1: searchProcedures ---');
  try {
    const searchResult = await convex.query(api.procedures.search, { query: 'MRI' });
    console.log('Search for "MRI":');
    console.log('Result type:', typeof searchResult);
    console.log('Is array:', Array.isArray(searchResult));
    console.log('Length:', searchResult?.length);
    console.log('Result:', JSON.stringify(searchResult, null, 2));
  } catch (error) {
    console.error('Search error:', error);
  }

  // Test 2: Get All Procedures
  console.log('\n--- TEST 2: getAll ---');
  try {
    const allProcedures = await convex.query(api.procedures.getAll, {});
    console.log('Total procedures:', allProcedures?.length);
    if (allProcedures && allProcedures.length > 0) {
      console.log('First procedure:', JSON.stringify(allProcedures[0], null, 2));
    }
  } catch (error) {
    console.error('GetAll error:', error);
  }

  // Test 3: Create Procedure
  console.log('\n--- TEST 3: createProcedure ---');
  let createdId: string | null = null;
  try {
    const createResult = await convex.mutation(api.procedures.create, {
      name: 'Test Procedure',
      nameEs: 'Procedimiento de Prueba',
      category: 'laboratory',
      requiresPreAuth: false,
      conditions: ['Test condition'],
      isExcluded: false,
      createdBy: 'test-script',
    });
    console.log('Create result:', createResult);
    console.log('Result type:', typeof createResult);
    createdId = String(createResult);
    console.log('Created ID:', createdId);
  } catch (error) {
    console.error('Create error:', error);
  }

  // Test 4: Update Procedure (if we created one)
  if (createdId) {
    console.log('\n--- TEST 4: updateProcedure ---');
    try {
      const updateResult = await convex.mutation(api.procedures.update, {
        id: createdId as any,
        name: 'Test Procedure Updated',
        requiresPreAuth: true,
      });
      console.log('Update result:', updateResult);
    } catch (error) {
      console.error('Update error:', error);
    }

    // Test 5: Delete Procedure
    console.log('\n--- TEST 5: deleteProcedure ---');
    try {
      const deleteResult = await convex.mutation(api.procedures.remove, {
        id: createdId as any,
      });
      console.log('Delete result:', deleteResult);
    } catch (error) {
      console.error('Delete error:', error);
    }
  }

  // Test 6: Search with different queries
  console.log('\n--- TEST 6: Search variations ---');
  const queries = ['surgery', 'imaging', 'X-Ray', 'acupuncture', 'nonexistent'];
  for (const query of queries) {
    try {
      const result = await convex.query(api.procedures.search, { query });
      console.log(`Search "${query}": ${result?.length || 0} results`);
    } catch (error) {
      console.error(`Search "${query}" error:`, error);
    }
  }

  console.log('\n✅ Tests completed');
}

testTools().catch(console.error);
