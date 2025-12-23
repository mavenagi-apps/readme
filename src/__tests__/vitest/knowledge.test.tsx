/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, it, vi, expect, beforeEach } from 'vitest';
import { MavenAGI, MavenAGIClient } from "mavenagi";
import {processFunction} from "@/inngest/functions/process";
import {InngestTestEngine} from "@inngest/test";

describe('runs the default workflow successfully', async () => {

   it('should import knowledge base data', { timeout: 1000000 }, async () => {

       const mockCreateOrUpdateKnowledgeBase = vi
           .spyOn(MavenAGIClient.prototype.knowledge, 'createOrUpdateKnowledgeBase')
           .mockImplementation(vi.fn());
       const mockCreateKnowledgeBaseVersion = vi
           .spyOn(MavenAGIClient.prototype.knowledge, 'createKnowledgeBaseVersion')
           .mockImplementation(vi.fn());
       const mockFinalizeKnowledgeBaseVersion = vi
           .spyOn(MavenAGIClient.prototype.knowledge, 'finalizeKnowledgeBaseVersion')
           .mockImplementation(vi.fn());
       const mockCreateKnowledgeDocument = vi
           .spyOn(MavenAGIClient.prototype.knowledge, 'createKnowledgeDocument')
           .mockImplementation(vi.fn());

       // Mock ALL README API calls that are actually made in the workflow
       const mockCategories = [
           { title: 'Getting Started', section: 'guide', links: { project: '/projects/me' }, uri: '/branches/stable/categories/guides/Getting Started' }
       ];

       const mockDocsInCategory = [
           { _id: 'doc1', title: 'Introduction', slug: 'intro', type: 'basic', category: 'cat1', categorySlug: 'docs', order: 1, hidden: false, createdAt: '2023-01-01', updatedAt: '2023-01-01', version: '1.0', isReference: false }
       ];

       const mockFullDocument = {
           slug: 'intro', 
           title: 'Introduction', 
           content: {
               body: 'Welcome to our documentation'
           },
           type: 'basic', 
           category: {
               title: 'Getting Started'
           },
           href: {
               hub: 'https://docs.example.com/docs/intro'
           },
           hidden: false, 
           createdAt: '2023-01-01', 
           updatedAt: '2023-01-01', 
           version: '1.0', 
           isReference: false
       };


       // Mock only the README API calls that are actually made in the workflow
       global.fetch = vi.fn().mockImplementation((url: string) => {
           const baseUrl = 'https://api.readme.com/v2';
           
           if (url === `${baseUrl}/branches/2025-01-01/categories/guides`) {
               return Promise.resolve({
                   ok: true,
                   json: () => Promise.resolve({ data: mockCategories })
               });
           }
           if (url.startsWith(`${baseUrl}/branches/stable/categories/guides/Getting Started/pages?page=`)) {
               return Promise.resolve({
                   ok: true,
                   json: () => Promise.resolve({ data: mockDocsInCategory, paging: { next: null } })
               });
           }
           if (url === `${baseUrl}/branches/2025-01-01/guides/intro`) {
               return Promise.resolve({
                   ok: true,
                   json: () => Promise.resolve({ data: mockFullDocument })
               });
           }
           if (url === `${baseUrl}/projects/me`) {
               return Promise.resolve({
                   ok: true,
                   json: () => Promise.resolve({ default_version: { name: '2025-01-01' } })
               });
           }
           return Promise.reject(new Error(`Unexpected URL: ${url}`));
       });

       // Mock the event data
       const event = {
           data: {
               organizationId: 'org1',
               agentId: 'agent1',
               settings: {
                   token: 'readme_token_123'
               },
           },
       };


       const t = new InngestTestEngine({
           function: processFunction,
       });

       await t.execute({
           events: [{ name: `app/${process.env.MAVENAGI_APP_ID}/process`, data: event.data }],
       });

       // Verify knowledge base creation calls
       expect(mockCreateOrUpdateKnowledgeBase).toHaveBeenCalledWith(
           expect.objectContaining({
               knowledgeBaseId: { referenceId: process.env.MAVENAGI_APP_ID },
               name: process.env.MAVENAGI_APP_NAME,
               metadata: {}
           })
       );

       expect(mockCreateKnowledgeBaseVersion).toHaveBeenCalledWith(
           process.env.MAVENAGI_APP_ID,
           { type: 'FULL' }
       );

       // Verify document creation with correct structure
       expect(mockCreateKnowledgeDocument).toHaveBeenCalledWith(
           process.env.MAVENAGI_APP_ID, // organizationId comes from env
           expect.objectContaining({
               knowledgeDocumentId: { referenceId: 'intro' },
               title: 'Introduction',
               content: 'Welcome to our documentation',
               contentType: MavenAGI.KnowledgeDocumentContentType.Markdown,
               url: 'https://docs.example.com/docs/intro',
               metadata: expect.objectContaining({
                   type: 'basic',
                   slug: 'intro',
                   category: 'Getting Started',
                   version: '1.0',
                   isReference: false,
                   hidden: false,
                   createdAt: '2023-01-01',
                   updatedAt: '2023-01-01'
               })
           })
       );

       // Verify all expected API calls were made
       expect(mockCreateOrUpdateKnowledgeBase).toHaveBeenCalledTimes(1);
       expect(mockCreateKnowledgeBaseVersion).toHaveBeenCalledTimes(1);
       expect(mockCreateKnowledgeDocument).toHaveBeenCalledTimes(1);
       expect(mockFinalizeKnowledgeBaseVersion).toHaveBeenCalledTimes(1);

   });
});
