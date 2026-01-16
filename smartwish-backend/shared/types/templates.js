"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CategoryStatus = exports.TemplateStatus = exports.CATEGORY_VALIDATION_RULES = exports.TEMPLATE_VALIDATION_RULES = void 0;
exports.TEMPLATE_VALIDATION_RULES = {
    MIN_TITLE_LENGTH: 3,
    MAX_TITLE_LENGTH: 100,
    MIN_DESCRIPTION_LENGTH: 10,
    MAX_DESCRIPTION_LENGTH: 500,
    MIN_PAGES: 1,
    MAX_PAGES: 10,
    MIN_HEADER_LENGTH: 1,
    MAX_HEADER_LENGTH: 100,
    MIN_TEXT_LENGTH: 1,
    MAX_TEXT_LENGTH: 2000
};
exports.CATEGORY_VALIDATION_RULES = {
    MIN_NAME_LENGTH: 3,
    MAX_NAME_LENGTH: 50,
    MIN_DESCRIPTION_LENGTH: 10,
    MAX_DESCRIPTION_LENGTH: 200
};
var TemplateStatus;
(function (TemplateStatus) {
    TemplateStatus["ACTIVE"] = "active";
    TemplateStatus["INACTIVE"] = "inactive";
    TemplateStatus["DRAFT"] = "draft";
    TemplateStatus["ARCHIVED"] = "archived";
})(TemplateStatus || (exports.TemplateStatus = TemplateStatus = {}));
var CategoryStatus;
(function (CategoryStatus) {
    CategoryStatus["ACTIVE"] = "active";
    CategoryStatus["INACTIVE"] = "inactive";
})(CategoryStatus || (exports.CategoryStatus = CategoryStatus = {}));
exports.default = {
    TEMPLATE_VALIDATION_RULES: exports.TEMPLATE_VALIDATION_RULES,
    CATEGORY_VALIDATION_RULES: exports.CATEGORY_VALIDATION_RULES,
    TemplateStatus,
    CategoryStatus
};
//# sourceMappingURL=templates.js.map