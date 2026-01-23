
import { Router } from 'express';
import * as scimController from '../../controllers/v1/scimController.js';
import { protectRoute } from '../../middleware/auth.middleware.js';

const router = Router();

// Apply authentication to all SCIM routes
router.use(protectRoute);

// Users Endpoints
router.get('/Users', scimController.getUsers);
router.post('/Users', scimController.createUser);
router.get('/Users/:id', scimController.getUser);
router.put('/Users/:id', scimController.updateUser);
router.patch('/Users/:id', scimController.patchUser);
router.delete('/Users/:id', scimController.deleteUser);

// Service Provider Config (Discovery)
router.get('/ServiceProviderConfig', (req, res) => {
    res.set('Content-Type', 'application/scim+json').json({
        schemas: ["urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"],
        patch: { supported: true },
        bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
        filter: { supported: true, maxResults: 100 },
        changePassword: { supported: false },
        sort: { supported: false },
        etag: { supported: false },
        authenticationSchemes: [
            {
                name: "OAuth Bearer Token",
                description: "Authentication scheme using the OAuth Bearer Token Standard",
                specUri: "http://www.rfc-editor.org/info/rfc6750",
                type: "oauthbearertoken",
                primary: true
            }
        ]
    });
});

export default router;
