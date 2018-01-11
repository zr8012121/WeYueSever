const userInfo = require('../../model/userInfo');
const constant = require("../../utils/constant");
const crypto = require('crypto');
const jwt = require('jsonwebtoken'); // 使用jwt签名
const config = require('../../config/config')
const express = require('express');
const app = express.Router();
const formidable = require('formidable');
const fs = require('fs');

const _filter = {
    __v: 0,
};


class UserController {

    constructor() {
    }

    /**
     * 用户注册
     * @param req
     * @param res
     * @param next
     */
    userRegister(req, res, next) {
        let name = req.query.name;
        let password = req.query.password;
        userInfo
            .findOne({name: name}, _filter)
            .exec((err, data) => {
                if (err) {
                    console.log(err);
                    return;
                }
                if (data != null) {
                    console.log('用户已经注册，请直接登录');
                    res.json({
                        code: constant.RESULT_CODE.SUCCESS.code,
                        msg: constant.RESULT_CODE.SUCCESS.msg,
                        data: '用户已经注册，请直接登录'
                    });
                    return;
                }
                //对密码进行加密存入数据库(注册时 前端传过来的密码是已经md5加密过，然后在这里加上WeYue字符串再次加密存入数据库)
                let pass = crypto.createHash('md5').update(password + 'WeYue').digest('hex');
                let token = jwt.sign({name: name}, 'wyjwtsecret', {
                    expiresIn: "30d"  // 一个月过期
                });

                let user = {};
                user.name = name;
                user.nickname = '微悦_' + name;
                user.password = pass;
                user.token = token;
                user.icon = '/images/avatar/default_avatar.jpg';
                user.brief = 'To be. or not to be. that is the question.';
                userInfo.create(user, (err, result) => {
                    if (err) {
                        console.log(err);
                        console.log('注册失败');
                        res.json({
                            code: constant.RESULT_CODE.SUCCESS.code,
                            msg: constant.RESULT_CODE.SUCCESS.msg,
                            data: '注册失败'
                        });
                        return
                    }
                    console.log(result);
                    console.log('注册成功');
                    res.json({
                        code: constant.RESULT_CODE.SUCCESS.code,
                        msg: constant.RESULT_CODE.SUCCESS.msg,
                        data: '注册成功'
                    });
                })


            });
    }


    /**
     * 用户登录
     * @param req
     * @param res
     * @param next
     */
    userLogin(req, res, next) {
        let name = req.query.name;
        let password = req.query.password;
        userInfo
            .findOne({name: name}, _filter)
            .exec((err, data) => {
                if (err) {
                    console.log(err);
                    return;
                }
                if (data == null) {
                    console.log('此用户没有注册');
                    res.json({
                        code: constant.RESULT_CODE.NO_DATA.code,
                        msg: '此用户没有注册',
                        data: {}
                    });
                    return;
                }
                console.log('password==' + password);
                //登录时先把前端传过来的密码进行md5
                let encrypt = crypto.createHash('md5').update(password).digest('hex');
                //然后对已经md5的密码带上WeYue字符串再次加密和数据库里面存入的密码对比
                let pass = crypto.createHash('md5').update(encrypt + 'WeYue').digest('hex');

                console.log('password==' + data.password + '==password==' + pass);
                if (data.password == pass) {
                    let token = jwt.sign({name: name}, 'wyjwtsecret', {
                        expiresIn: "30d" // 一个月过期
                    });
                    console.log("tokenlogin==" + token);
                    userInfo.update({name: name}, {token: token}, (err, result) => {
                        if (err) {
                            console.log(err);
                        } else {
                            console.log('更新token成功');
                        }
                    });

                    //把最新的token存入数据库
                    data.token = token;

                    res.json({
                        code: constant.RESULT_CODE.SUCCESS.code,
                        msg: constant.RESULT_CODE.SUCCESS.msg,
                        data: data
                    });
                } else {
                    res.json({
                        code: constant.RESULT_CODE.ARG_ERROR.code,
                        msg: '密码错误',
                        data: {}
                    });
                }
            });

    }


    // userinfo(req, res, next) {
    //     let name = req.query.name;
    //     if (!name) {
    //         res.json({
    //             code: constant.RESULT_CODE.ARG_ERROR.code,
    //             msg: constant.RESULT_CODE.ARG_ERROR.msg,
    //             data: 'name不能为空'
    //         })
    //         return;
    //     }
    //     userInfo.findOne({name: name}, _filter, (err, data) => {
    //         if (err) {
    //             console.log(err);
    //             res.json({
    //                 code: constant.RESULT_CODE.NO_DATA.code,
    //                 msg: '获取用户信息失败',
    //                 data: {}
    //             })
    //             return;
    //         }
    //
    //         res.json({
    //             code: constant.RESULT_CODE.SUCCESS.code,
    //             msg: constant.RESULT_CODE.SUCCESS.msg,
    //             data: data
    //         })
    //         return;
    //
    //
    //     })
    // }


    /**
     * 上传用户图像
     * @param req
     * @param res
     * @param next
     */
    userUploadAvatar(req, res, next) {
        let name = req.query.name;
        if (!name) {
            res.json({
                code: constant.RESULT_CODE.ARG_ERROR.code,
                msg: constant.RESULT_CODE.ARG_ERROR.msg,
                data: 'name不能为空'
            })
            return;
        }

        let form = new formidable.IncomingForm();//创建上传表单
        form.encoding = 'utf-8'; //设置编辑
        form.uploadDir = '../public/images/avatar/';//设置上传目录
        form.keepExtensions = true;//保留后缀
        form.maxFieldsSize = 2 * 1024 * 1024;//文件大小

        form.parse(req, (err, fields, files) => {
            if (err) {
                res.json({
                    code: constant.RESULT_CODE.UPLOAD_ERR.code,
                    msg: constant.RESULT_CODE.UPLOAD_ERR.msg,
                    data: '上传头像失败'
                });
                return;
            }
            console.log(files);
            let extName = 'jpg';//后缀名
            switch (files.avatar.type) {
                case 'image/pjpeg':
                    extName = 'jpg';
                    break;
                case 'image/jpeg':
                    extName = 'jpg';
                    break;
                case 'image/png':
                    extName = 'png';
                    break;
                case 'image/x-png':
                    extName = 'png';
                    break;
            }

            if (extName.length == 0) {
                res.json({
                    code: constant.RESULT_CODE.UPLOAD_ERR.code,
                    msg: constant.RESULT_CODE.UPLOAD_ERR.msg,
                    data: '只支持png和jpg格式图片'
                });
            }

            let avatarName = "WeYue" + name + '.' + extName;
            //图片写入地址
            let newPath = form.uploadDir + avatarName;
            //显示地址
            let showUrl = '/images/avatar/' + avatarName;
            console.log('newPath', newPath);
            fs.renameSync(files.avatar.path, newPath);

            userInfo.update({name: name}, {icon: showUrl}, (err, result) => {
                if (err) {
                    console.log(err);
                    res.json({
                        code: constant.RESULT_CODE.UPLOAD_ERR.code,
                        msg: constant.RESULT_CODE.UPLOAD_ERR.msg,
                        data: {}
                    })
                } else {
                    console.log('更新头像成功');
                    res.json({
                        code: constant.RESULT_CODE.SUCCESS.code,
                        msg: constant.RESULT_CODE.SUCCESS.msg,
                        data: showUrl
                    })
                }
            });


        })

    }

    /**
     * 修改用户密码
     * @param req
     * @param res
     * @param next
     */
    updatePassword(req, res, next) {
        let name = req.query.name;
        let password = req.query.password;
        if (!password || !name) {
            res.json({
                code: constant.RESULT_CODE.ARG_ERROR.code,
                msg: 'password或name参数不能为空',
                data: 'password或name参数不能为空'
            })
            return;
        }

        //登录时先把前端传过来的密码进行md5
        let encrypt = crypto.createHash('md5').update(password).digest('hex');
        //然后对已经md5的密码带上WeYue字符串再次加密和数据库里面存入的密码对比
        let pass = crypto.createHash('md5').update(encrypt + 'WeYue').digest('hex');

        userInfo.findOne({name: name}, (err, data) => {
            if (data.password == pass) {
                res.json({
                    code: constant.RESULT_CODE.SUCCESS.code,
                    msg: constant.RESULT_CODE.SUCCESS.msg,
                    data: '新密码与旧密码一致,无需修改'
                })
                return;
            }

            //数据库更新密码
            userInfo.update({name: name}, {password: pass}, (err, result) => {
                if (err) {
                    console.log(err);
                    res.json({
                        code: constant.RESULT_CODE.SUCCESS.code,
                        msg: constant.RESULT_CODE.SUCCESS.msg,
                        data: '修改密码失败'
                    })
                } else {
                    console.log('修改密码成功');
                    res.json({
                        code: constant.RESULT_CODE.SUCCESS.code,
                        msg: constant.RESULT_CODE.SUCCESS.msg,
                        data: '修改密码成功'
                    })
                }
            });
        })


    }


    /**
     * 修改用户信息
     * @param req
     * @param res
     * @param next
     */
    updateUserInfo(req, res, next) {
        let name = req.query.name;
        let nickname = req.query.nickname;
        let brief = req.query.brief;
        if (!name || !nickname || !brief) {
            res.json({
                code: constant.RESULT_CODE.ARG_ERROR.code,
                msg: '请求参数不能为空',
                data: {}
            })
            return;
        }

        //数据库更新用户信息
        userInfo.update({name: name}, {nickname: nickname, brief: brief}, (err, result) => {
            if (err) {
                console.log(err);
                res.json({
                    code: constant.RESULT_CODE.SUCCESS.code,
                    msg: constant.RESULT_CODE.SUCCESS.msg,
                    data: '修改用户信息失败'
                })
            } else {
                console.log('修改用户信息成功');
                res.json({
                    code: constant.RESULT_CODE.SUCCESS.code,
                    msg: constant.RESULT_CODE.SUCCESS.msg,
                    data: '修改用户信息成功'
                })
            }
        });
    }
}


module
    .exports = new UserController();